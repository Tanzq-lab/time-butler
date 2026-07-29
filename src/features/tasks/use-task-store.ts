import { create } from "zustand";
import {
  getTaskItemType,
  isFocusTask,
  type Task,
  type TaskItemType,
} from "@/features/tasks/task-types";
import {
  appendPomodoroEstimationLog,
  buildCompletionLogEntry,
} from "@/features/tasks/pomodoro-estimation-log";
import {
  getTasks,
  addTask as dbAddTask,
  addTodoTask as dbAddTodoTask,
  updateTask as dbUpdateTask,
  setTaskItemType as dbSetTaskItemType,
  setTaskCompleted as dbSetTaskCompleted,
  reorderTasks as dbReorderTasks,
  deleteTask as dbDeleteTask,
  toggleTaskArchived,
  incrementTaskPomos,
  completeTask as dbCompleteTask,
  appendTaskNote as dbAppendTaskNote,
  getCategories,
  getSetting,
  recordAppEvent,
  setSetting,
} from "@/lib/db";
import { ensureRecurringSummaryTasks } from "@/features/tasks/recurring-summary-tasks";
import { parseTaskDraft } from "@/features/tasks/task-intake";

async function inferCategoryIdFromTaskName(
  name: string,
  categoryId?: number | null,
): Promise<number | null> {
  if (categoryId) return categoryId;

  const categoryName = parseTaskDraft(name).categoryName;
  if (!categoryName) return categoryId ?? null;

  const categories = await getCategories();
  return categories.find((category) => category.name === categoryName)?.id ?? null;
}

interface TaskStore {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  loadTasks: () => Promise<void>;
  addTask: (
    name: string,
    estimatedPomos: number,
    project?: string,
    priority?: string,
    categoryId?: number | null,
    scheduledFor?: string | null,
    parentId?: number | null,
  ) => Promise<Task | null>;
  addTodo: (name: string, parentId?: number | null) => Promise<Task | null>;
  addSubtask: (parentId: number, name: string) => Promise<Task | null>;
  setCompleted: (id: number, completed: boolean) => Promise<boolean>;
  setItemType: (
    id: number,
    itemType: TaskItemType,
    estimatedPomos?: number,
  ) => Promise<boolean>;
  updateTask: (
    id: number,
    name?: string,
    estimatedPomos?: number,
    project?: string | null,
    priority?: string | null,
    categoryId?: number | null,
    scheduledFor?: string | null,
  ) => Promise<void>;
  reorderTasks: (
    orderedIds: number[],
    parentId?: number | null,
  ) => Promise<boolean>;
  deleteTask: (id: number) => Promise<boolean>;
  archiveTask: (id: number) => Promise<void>;
  incrementPomos: (
    id: number,
    review?: string,
    options?: { alreadyPersisted?: boolean; sessionId?: number },
  ) => Promise<void>;
  completeTask: (
    id: number,
    actualPomos: number,
    review?: string,
  ) => Promise<void>;
  appendTaskNote: (
    id: number,
    content: string,
    source: "task-card" | "timer",
  ) => Promise<boolean>;
}

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const sortOrder = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (sortOrder !== 0) return sortOrder;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

async function loadSortedTasks(): Promise<Task[]> {
  return sortTasks(await getTasks());
}

function recordParentCompletionTransition(
  before: Task[],
  after: Task[],
  parentId: number | null,
  sourceTaskId: number,
): void {
  if (parentId == null) return;
  const previousParent = before.find((task) => task.id === parentId);
  const nextParent = after.find((task) => task.id === parentId);
  if (!previousParent || !nextParent) return;

  const wasDone = Boolean(previousParent.completed_at);
  const isDone = Boolean(nextParent.completed_at);
  if (wasDone === isDone) return;

  void recordAppEvent({
    eventName: isDone ? "task_group_completed" : "task_group_reopened",
    route: "/tasks",
    entityType: "task",
    entityId: parentId,
    metadata: { sourceTaskId },
  });
}

function reconcileParentInState(
  tasks: Task[],
  parentId: number | null,
  completedAt = new Date().toISOString(),
): Task[] {
  if (parentId == null) return tasks;
  const children = tasks.filter(
    (task) => task.archived === 0 && (task.parent_id ?? null) === parentId,
  );
  const allChildrenDone =
    children.length > 0 && children.every((task) => Boolean(task.completed_at));

  return tasks.map((task) => {
    if (task.id !== parentId) return task;
    return {
      ...task,
      completed_at: allChildrenDone
        ? task.completed_at ?? completedAt
        : null,
    };
  });
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  loading: false,
  error: null,

  loadTasks: async () => {
    set({ loading: true, error: null });
    try {
      let tasks = await getTasks();
      const hasSeeded = await getSetting("has_seeded_tasks");

      if (tasks.filter(isFocusTask).length === 0) {
        if (!hasSeeded) {
          await dbAddTask("规划第一个项目", 4, "个人");
          await dbAddTask("整理重要资料", 2, "工作");
          await dbAddTask("今天学习一点新东西", 3, "学习");
          await setSetting("has_seeded_tasks", "true");
          tasks = await getTasks();
        }
      } else if (!hasSeeded) {
        await setSetting("has_seeded_tasks", "true");
      }

      await ensureRecurringSummaryTasks();
      tasks = await loadSortedTasks();
      set({ tasks, loading: false });
    } catch (err) {
      console.error("[TaskStore] Failed to load tasks:", err);
      set({ loading: false, error: String(err) });
    }
  },

  addTask: async (
    name,
    estimatedPomos,
    project,
    priority,
    categoryId,
    scheduledFor,
    parentId = null,
  ) => {
    const parent = parentId == null
      ? null
      : get().tasks.find((task) => task.id === parentId);
    if (parentId != null && (!parent || (parent.parent_id ?? null) !== null)) {
      return null;
    }

    try {
      const before = get().tasks;
      const resolvedCategoryId = parentId == null
        ? await inferCategoryIdFromTaskName(name, categoryId)
        : categoryId ?? null;
      const id = await dbAddTask(
        name,
        estimatedPomos,
        project,
        priority,
        resolvedCategoryId,
        scheduledFor,
        parentId,
      );
      const siblingSortOrders = before
        .filter((task) => (task.parent_id ?? null) === parentId)
        .map((task) => task.sort_order ?? 0);
      const newTask: Task = {
        id,
        name,
        item_type: "focus",
        parent_id: parentId,
        estimated_pomos: estimatedPomos,
        completed_pomos: 0,
        project: project ?? undefined,
        priority: priority as Task["priority"] | undefined,
        sort_order: siblingSortOrders.length === 0
          ? parentId == null ? -1 : 0
          : parentId == null
            ? Math.min(...siblingSortOrders) - 1
            : Math.max(...siblingSortOrders) + 1,
        category_id: resolvedCategoryId,
        scheduled_for: scheduledFor ?? null,
        completed_at: null,
        completion_review: null,
        notes: null,
        created_at: new Date().toISOString(),
        archived: 0,
      };
      const tasks = reconcileParentInState(
        sortTasks([newTask, ...before]),
        parentId,
      );
      set({ tasks, error: null });
      recordParentCompletionTransition(before, tasks, parentId, id);
      void recordAppEvent({
        eventName: parentId == null ? "task_added" : "subtask_added",
        route: "/tasks",
        entityType: "task",
        entityId: id,
        metadata: {
          estimatedPomos,
          hasProject: Boolean(project?.trim()),
          hasPriority: Boolean(priority?.trim()),
          hasCategory: resolvedCategoryId != null,
          hasSchedule: Boolean(scheduledFor),
          categoryInferred: resolvedCategoryId != null && categoryId == null,
          itemType: "focus",
          parentId,
        },
      });
      return newTask;
    } catch (err) {
      console.error("[TaskStore] Failed to add task:", err);
      set({ error: String(err) });
      return null;
    }
  },

  addTodo: async (name, parentId = null) => {
    const cleanName = name.trim();
    if (!cleanName) return null;

    try {
      const before = get().tasks;
      const id = await dbAddTodoTask(cleanName, parentId);
      const tasks = await loadSortedTasks();
      set({ tasks, error: null });
      recordParentCompletionTransition(before, tasks, parentId, id);
      void recordAppEvent({
        eventName: parentId == null ? "todo_added" : "subtask_added",
        route: "/tasks",
        entityType: "task",
        entityId: id,
        metadata: { parentId },
      });
      return tasks.find((task) => task.id === id) ?? null;
    } catch (err) {
      console.error("[TaskStore] Failed to add todo:", err);
      set({ error: String(err) });
      return null;
    }
  },

  addSubtask: async (parentId, name) => {
    const parent = get().tasks.find((task) => task.id === parentId);
    const hasParent = Boolean(parent && (parent.parent_id ?? null) === null);
    if (!hasParent) return null;
    return get().addTodo(name, parentId);
  },

  setCompleted: async (id, completed) => {
    try {
      const before = get().tasks;
      const parentId = await dbSetTaskCompleted(id, completed);
      const completedAt = completed ? new Date().toISOString() : null;
      const updatedTasks = before.map((task) =>
        task.id === id ? { ...task, completed_at: completedAt } : task,
      );
      const tasks = reconcileParentInState(updatedTasks, parentId);
      set({ tasks, error: null });
      recordParentCompletionTransition(before, tasks, parentId, id);
      void recordAppEvent({
        eventName: completed ? "todo_completed" : "todo_reopened",
        route: "/tasks",
        entityType: "task",
        entityId: id,
        metadata: { parentId },
      });
      return true;
    } catch (err) {
      console.error("[TaskStore] Failed to update completion:", err);
      set({ error: String(err) });
      return false;
    }
  },

  setItemType: async (id, itemType, estimatedPomos) => {
    const task = get().tasks.find((candidate) => candidate.id === id);
    if (!task || getTaskItemType(task) === itemType) return Boolean(task);
    if (itemType === "todo" && task.completed_pomos !== 0) return false;

    try {
      await dbSetTaskItemType(id, itemType, estimatedPomos);
      const tasks = get().tasks.map((candidate) =>
        candidate.id === id
          ? {
              ...candidate,
              item_type: itemType,
              ...(itemType === "focus" && {
                estimated_pomos: estimatedPomos ?? 1,
              }),
            }
          : candidate,
      );
      set({ tasks, error: null });
      void recordAppEvent({
        eventName: "task_type_changed",
        route: "/tasks",
        entityType: "task",
        entityId: id,
        metadata: {
          from: getTaskItemType(task),
          to: itemType,
          estimatedPomos: itemType === "focus" ? estimatedPomos ?? 1 : null,
        },
      });
      return true;
    } catch (err) {
      console.error("[TaskStore] Failed to change task type:", err);
      set({ error: String(err) });
      return false;
    }
  },

  updateTask: async (
    id,
    name,
    estimatedPomos,
    project,
    priority,
    categoryId,
    scheduledFor,
  ) => {
    try {
      await dbUpdateTask(
        id,
        name,
        estimatedPomos,
        project,
        priority,
        categoryId,
        scheduledFor,
      );
      set((state) => ({
        tasks: state.tasks.map((t) => {
          if (t.id !== id) return t;
          return {
            ...t,
            ...(name !== undefined && { name }),
            ...(estimatedPomos !== undefined && {
              estimated_pomos: estimatedPomos,
            }),
            ...(project !== undefined && { project: project ?? undefined }),
            ...(priority !== undefined && {
              priority: priority as Task["priority"] | undefined,
            }),
            ...(categoryId !== undefined && {
              category_id: categoryId ?? null,
            }),
            ...(scheduledFor !== undefined && {
              scheduled_for: scheduledFor ?? null,
            }),
          };
        }),
        error: null,
      }));
      void recordAppEvent({
        eventName: "task_updated",
        route: "/tasks",
        entityType: "task",
        entityId: id,
        metadata: {
          changedFields: [
            name !== undefined ? "name" : null,
            estimatedPomos !== undefined ? "estimated_pomos" : null,
            project !== undefined ? "project" : null,
            priority !== undefined ? "priority" : null,
            categoryId !== undefined ? "category_id" : null,
            scheduledFor !== undefined ? "scheduled_for" : null,
          ].filter(Boolean),
        },
      });
    } catch (err) {
      console.error("[TaskStore] Failed to update task:", err);
      set({ error: String(err) });
    }
  },

  reorderTasks: async (orderedIds, parentId = null) => {
    const siblingTasks = get().tasks.filter(
      (task) => (task.parent_id ?? null) === parentId,
    );
    const visibleTaskIds = new Set(siblingTasks.map((task) => task.id));
    const validIds =
      orderedIds.length > 0
      && new Set(orderedIds).size === orderedIds.length
      && orderedIds.every((id) => Number.isInteger(id) && visibleTaskIds.has(id));
    if (!validIds) return false;

    const currentOrder = get()
      .tasks
      .filter((task) => orderedIds.includes(task.id))
      .map((task) => task.id);
    if (orderedIds.every((id, index) => id === currentOrder[index])) return true;

    try {
      if (parentId == null) await dbReorderTasks(orderedIds);
      else await dbReorderTasks(orderedIds, parentId);
      const sortOrderById = new Map(orderedIds.map((id, index) => [id, index]));
      set((state) => ({
        tasks: sortTasks(
          state.tasks.map((task) => {
            const sortOrder = sortOrderById.get(task.id);
            return sortOrder === undefined ? task : { ...task, sort_order: sortOrder };
          }),
        ),
        error: null,
      }));
      void recordAppEvent({
        eventName: "task_reordered",
        route: "/tasks",
        entityType: "task_list",
        metadata: {
          scope: parentId == null ? "root" : "children",
          parentId,
          count: orderedIds.length,
        },
      });
      return true;
    } catch (err) {
      console.error("[TaskStore] Failed to reorder tasks:", err);
      set({ error: String(err) });
      return false;
    }
  },

  deleteTask: async (id) => {
    try {
      const before = get().tasks;
      const deletedTask = before.find((task) => task.id === id);
      const parentId = deletedTask?.parent_id ?? null;
      await dbDeleteTask(id);
      const deletedIds = new Set([
        id,
        ...before
          .filter((task) => (task.parent_id ?? null) === id)
          .map((task) => task.id),
      ]);
      const tasks = reconcileParentInState(
        before.filter((task) => !deletedIds.has(task.id)),
        parentId,
      );
      set({ tasks, error: null });
      recordParentCompletionTransition(before, tasks, parentId, id);
      void recordAppEvent({
        eventName: "task_deleted",
        route: "/tasks",
        entityType: "task",
        entityId: id,
      });
      return true;
    } catch (err) {
      console.error("[TaskStore] Failed to delete task:", err);
      set({ error: String(err) });
      return false;
    }
  },

  archiveTask: async (id) => {
    try {
      await toggleTaskArchived(id, true);
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
        error: null,
      }));
      void recordAppEvent({
        eventName: "task_archived",
        route: "/tasks",
        entityType: "task",
        entityId: id,
      });
    } catch (err) {
      console.error("[TaskStore] Failed to archive task:", err);
      set({ error: String(err) });
    }
  },

  incrementPomos: async (id, review, options) => {
    try {
      if (!options?.alreadyPersisted) {
        await incrementTaskPomos(id);
      }
      let completionLogTask: Task | null = null;
      set((state) => ({
        tasks: state.tasks.map((t) => {
          if (t.id !== id) return t;
          const nextTask = {
            ...t,
            completed_pomos: t.completed_pomos + 1,
          };
          if (
            nextTask.completed_pomos > nextTask.estimated_pomos &&
            t.completed_pomos <= t.estimated_pomos
          ) {
            completionLogTask = nextTask;
          }
          return nextTask;
        }),
        error: null,
      }));
      if (completionLogTask) {
        const entry = buildCompletionLogEntry(completionLogTask, review);
        if (entry) await appendPomodoroEstimationLog(entry);
      }
      void recordAppEvent({
        eventName: "task_pomo_incremented",
        route: "/",
        entityType: "task",
        entityId: id,
        metadata: {
          promptedReview: Boolean(completionLogTask),
          hasReview: Boolean(review?.trim()),
          sessionId: options?.sessionId ?? null,
          persistedBySessionCredit: Boolean(options?.alreadyPersisted),
        },
      });
    } catch (err) {
      console.error("[TaskStore] Failed to increment pomos:", err);
      set({ error: String(err) });
    }
  },

  completeTask: async (id, actualPomos, review) => {
    try {
      const safeActualPomos = Math.max(0, Math.floor(actualPomos));
      const before = get().tasks;
      const parentId = await dbCompleteTask(id, safeActualPomos, review);
      const completedAt = new Date().toISOString();
      let completionLogTask: Task | null = null;
      let estimateDelta = 0;

      set((state) => ({
        tasks: state.tasks.map((t) => {
          if (t.id !== id) return t;
          const nextTask = {
            ...t,
            completed_pomos: safeActualPomos,
            completed_at: completedAt,
            completion_review: review?.trim() || null,
          };
          estimateDelta = nextTask.completed_pomos - nextTask.estimated_pomos;
          if (estimateDelta !== 0) {
            completionLogTask = nextTask;
          }
          return nextTask;
        }),
        error: null,
      }));

      if (completionLogTask) {
        const entry = buildCompletionLogEntry(completionLogTask, review);
        if (entry) await appendPomodoroEstimationLog(entry);
      }
      const tasks = reconcileParentInState(get().tasks, parentId);
      set({ tasks, error: null });
      recordParentCompletionTransition(before, tasks, parentId, id);
      void recordAppEvent({
        eventName: "task_completed",
        route: "/tasks",
        entityType: "task",
        entityId: id,
        metadata: {
          actualPomos: safeActualPomos,
          estimateDelta,
          hasReview: Boolean(review?.trim()),
        },
      });
    } catch (err) {
      console.error("[TaskStore] Failed to complete task:", err);
      set({ error: String(err) });
    }
  },

  appendTaskNote: async (id, content, source) => {
    const trimmedContent = content.trim();
    if (!trimmedContent) return false;

    try {
      const notes = await dbAppendTaskNote(id, trimmedContent);
      set((state) => ({
        tasks: state.tasks.map((task) =>
          task.id === id ? { ...task, notes } : task,
        ),
        error: null,
      }));
      void recordAppEvent({
        eventName: "task_note_appended",
        route: source === "timer" ? "/" : "/tasks",
        entityType: "task",
        entityId: id,
        metadata: {
          source,
          characterCount: trimmedContent.length,
        },
      });
      return true;
    } catch (err) {
      console.error("[TaskStore] Failed to append task note:", err);
      set({ error: String(err) });
      return false;
    }
  },
}));
