import { create } from "zustand";
import type { Task } from "@/features/tasks/task-types";
import {
  appendPomodoroEstimationLog,
  buildCompletionLogEntry,
} from "@/features/tasks/pomodoro-estimation-log";
import {
  getTasks,
  addTask as dbAddTask,
  updateTask as dbUpdateTask,
  deleteTask as dbDeleteTask,
  toggleTaskArchived,
  incrementTaskPomos,
  completeTask as dbCompleteTask,
  getSetting,
  setSetting,
} from "@/lib/db";
import { ensureRecurringSummaryTasks } from "@/features/tasks/recurring-summary-tasks";

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
    weekPlanItemId?: number | null,
  ) => Promise<void>;
  updateTask: (
    id: number,
    name?: string,
    estimatedPomos?: number,
    project?: string | null,
    priority?: string | null,
    categoryId?: number | null,
    scheduledFor?: string | null,
    weekPlanItemId?: number | null,
  ) => Promise<void>;
  deleteTask: (id: number) => Promise<void>;
  archiveTask: (id: number) => Promise<void>;
  incrementPomos: (id: number, review?: string) => Promise<void>;
  completeTask: (
    id: number,
    actualPomos: number,
    review?: string,
  ) => Promise<void>;
}

export const useTaskStore = create<TaskStore>((set) => ({
  tasks: [],
  loading: false,
  error: null,

  loadTasks: async () => {
    set({ loading: true, error: null });
    try {
      let tasks = await getTasks();
      const hasSeeded = await getSetting("has_seeded_tasks");

      if (tasks.length === 0) {
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
      tasks = await getTasks();
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
    weekPlanItemId,
  ) => {
    try {
      const id = await dbAddTask(
        name,
        estimatedPomos,
        project,
        priority,
        categoryId,
        scheduledFor,
        weekPlanItemId,
      );
      const newTask: Task = {
        id,
        name,
        estimated_pomos: estimatedPomos,
        completed_pomos: 0,
        project: project ?? undefined,
        priority: priority as Task["priority"] | undefined,
        category_id: categoryId ?? null,
        scheduled_for: scheduledFor ?? null,
        week_plan_item_id: weekPlanItemId ?? null,
        completed_at: null,
        completion_review: null,
        created_at: new Date().toISOString(),
        archived: 0,
      };
      set((state) => ({
        tasks: [newTask, ...state.tasks],
        error: null,
      }));
    } catch (err) {
      console.error("[TaskStore] Failed to add task:", err);
      set({ error: String(err) });
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
    weekPlanItemId,
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
        weekPlanItemId,
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
            ...(weekPlanItemId !== undefined && {
              week_plan_item_id: weekPlanItemId ?? null,
            }),
          };
        }),
        error: null,
      }));
    } catch (err) {
      console.error("[TaskStore] Failed to update task:", err);
      set({ error: String(err) });
    }
  },

  deleteTask: async (id) => {
    try {
      await dbDeleteTask(id);
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
        error: null,
      }));
    } catch (err) {
      console.error("[TaskStore] Failed to delete task:", err);
      set({ error: String(err) });
    }
  },

  archiveTask: async (id) => {
    try {
      await toggleTaskArchived(id, true);
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
        error: null,
      }));
    } catch (err) {
      console.error("[TaskStore] Failed to archive task:", err);
      set({ error: String(err) });
    }
  },

  incrementPomos: async (id, review) => {
    try {
      await incrementTaskPomos(id);
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
    } catch (err) {
      console.error("[TaskStore] Failed to increment pomos:", err);
      set({ error: String(err) });
    }
  },

  completeTask: async (id, actualPomos, review) => {
    try {
      const safeActualPomos = Math.max(0, Math.floor(actualPomos));
      await dbCompleteTask(id, safeActualPomos, review);
      const completedAt = new Date().toISOString();
      let completionLogTask: Task | null = null;

      set((state) => ({
        tasks: state.tasks.map((t) => {
          if (t.id !== id) return t;
          const nextTask = {
            ...t,
            completed_pomos: safeActualPomos,
            completed_at: completedAt,
            completion_review: review?.trim() || null,
          };
          if (nextTask.completed_pomos !== nextTask.estimated_pomos) {
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
    } catch (err) {
      console.error("[TaskStore] Failed to complete task:", err);
      set({ error: String(err) });
    }
  },
}));
