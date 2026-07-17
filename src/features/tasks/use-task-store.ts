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
  updateTaskCategoryIfUnchanged as dbUpdateTaskCategoryIfUnchanged,
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
import {
  classifyTaskCategory,
  type AiCategoryConfidence,
} from "@/lib/ai-category";
import { useSettingsStore } from "@/features/settings/use-settings-store";

type CategoryInferenceSource = "manual" | "ai" | "rule" | "none";

interface CategoryResolution {
  categoryId: number | null;
  source: CategoryInferenceSource;
  aiAttempted: boolean;
  aiConfidence?: AiCategoryConfidence;
  aiFailure?: string;
}

const AI_FAILURE_CODES = [
  "api_key_missing",
  "api_key_read_failed",
  "api_key_rejected",
  "rate_limited",
  "network_error",
  "service_unavailable",
  "invalid_ai_response",
  "invalid_api_request",
  "no_categories",
  "ai_unavailable",
] as const;

function normalizeAiFailure(error: unknown): string {
  const message = String(error);
  return AI_FAILURE_CODES.find((code) => message.includes(code)) ?? "unknown";
}

async function resolveAutomaticCategory(
  name: string,
  project?: string,
  categoryName?: string,
  aiEnabled = false,
): Promise<CategoryResolution> {
  const categories = await getCategories();
  let aiAttempted = false;
  let aiConfidence: AiCategoryConfidence | undefined;
  let aiFailure: string | undefined;

  if (aiEnabled && categories.length === 0) {
    aiFailure = "no_categories";
  }

  if (aiEnabled && categories.length > 0) {
    aiAttempted = true;
    try {
      const result = await classifyTaskCategory({
        taskName: name,
        project: project?.trim() || undefined,
        categories: categories.map(({ id, name: categoryLabel }) => ({
          id,
          name: categoryLabel,
        })),
      });
      aiConfidence = result.confidence;
      const matchedCategory = categories.find(
        (category) => category.id === result.categoryId,
      );
      if (matchedCategory && result.confidence !== "low") {
        return {
          categoryId: matchedCategory.id,
          source: "ai",
          aiAttempted: true,
          aiConfidence: result.confidence,
        };
      }
      aiFailure = matchedCategory ? "low_confidence" : "invalid_ai_response";
    } catch (error) {
      aiFailure = normalizeAiFailure(error);
    }
  }

  const ruleCategory = categoryName
    ? categories.find((category) => category.name === categoryName)
    : null;
  return {
    categoryId: ruleCategory?.id ?? null,
    source: ruleCategory ? "rule" : "none",
    aiAttempted,
    aiConfidence,
    aiFailure,
  };
}

interface PostCreationCategorizationInput {
  taskId: number;
  name: string;
  project?: string;
  expectedCategoryId: number | null;
  categoryName?: string;
  aiEnabled: boolean;
}

async function categorizeTaskAfterCreation({
  taskId,
  name,
  project,
  expectedCategoryId,
  categoryName,
  aiEnabled,
}: PostCreationCategorizationInput): Promise<void> {
  const startedAt = Date.now();
  let resolution: CategoryResolution;

  try {
    resolution = await resolveAutomaticCategory(
      name,
      project,
      categoryName,
      aiEnabled,
    );
  } catch {
    void recordAppEvent({
      eventName: "task_category_auto_assignment_finished",
      route: "/tasks",
      entityType: "task",
      entityId: taskId,
      metadata: {
        outcome: "failed",
        categoryInferenceSource: "none",
        aiCategorizationAttempted: false,
        aiCategorizationConfidence: null,
        aiCategorizationFailure: "category_lookup_failed",
        durationMs: Date.now() - startedAt,
      },
    });
    return;
  }

  if (resolution.categoryId == null) {
    void recordAppEvent({
      eventName: "task_category_auto_assignment_finished",
      route: "/tasks",
      entityType: "task",
      entityId: taskId,
      metadata: {
        outcome: resolution.aiFailure ? "failed" : "no_match",
        categoryInferenceSource: resolution.source,
        aiCategorizationAttempted: resolution.aiAttempted,
        aiCategorizationConfidence: resolution.aiConfidence ?? null,
        aiCategorizationFailure: resolution.aiFailure ?? null,
        durationMs: Date.now() - startedAt,
      },
    });
    return;
  }

  try {
    const applied = await dbUpdateTaskCategoryIfUnchanged(
      taskId,
      expectedCategoryId,
      resolution.categoryId,
    );

    if (applied) {
      useTaskStore.setState((state) => ({
        tasks: state.tasks.map((task) =>
          task.id === taskId && task.category_id === expectedCategoryId
            ? { ...task, category_id: resolution.categoryId }
            : task,
        ),
      }));
    }

    void recordAppEvent({
      eventName: "task_category_auto_assignment_finished",
      route: "/tasks",
      entityType: "task",
      entityId: taskId,
      metadata: {
        outcome: applied ? "applied" : "skipped_changed",
        categoryId: resolution.categoryId,
        categoryInferenceSource: resolution.source,
        aiCategorizationAttempted: resolution.aiAttempted,
        aiCategorizationConfidence: resolution.aiConfidence ?? null,
        aiCategorizationFailure: resolution.aiFailure ?? null,
        durationMs: Date.now() - startedAt,
      },
    });
  } catch {
    void recordAppEvent({
      eventName: "task_category_auto_assignment_finished",
      route: "/tasks",
      entityType: "task",
      entityId: taskId,
      metadata: {
        outcome: "failed",
        categoryId: resolution.categoryId,
        categoryInferenceSource: resolution.source,
        aiCategorizationAttempted: resolution.aiAttempted,
        aiCategorizationConfidence: resolution.aiConfidence ?? null,
        aiCategorizationFailure: "category_update_failed",
        durationMs: Date.now() - startedAt,
      },
    });
  }
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
  ) => Promise<Task | null>;
  updateTask: (
    id: number,
    name?: string,
    estimatedPomos?: number,
    project?: string | null,
    priority?: string | null,
    categoryId?: number | null,
    scheduledFor?: string | null,
  ) => Promise<void>;
  deleteTask: (id: number) => Promise<void>;
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

export const useTaskStore = create<TaskStore>((set, get) => ({
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
  ) => {
    try {
      const initialCategoryId = categoryId ?? null;
      const categoryName =
        categoryId == null ? parseTaskDraft(name).categoryName : undefined;
      const aiEnabled =
        categoryId == null &&
        useSettingsStore.getState().settings.aiAutoCategorization;
      const automaticCategorizationScheduled =
        categoryId == null && (aiEnabled || Boolean(categoryName));
      const id = await dbAddTask(
        name,
        estimatedPomos,
        project,
        priority,
        initialCategoryId,
        scheduledFor,
      );
      const newTask: Task = {
        id,
        name,
        estimated_pomos: estimatedPomos,
        completed_pomos: 0,
        project: project ?? undefined,
        priority: priority as Task["priority"] | undefined,
        category_id: initialCategoryId,
        scheduled_for: scheduledFor ?? null,
        completed_at: null,
        completion_review: null,
        notes: null,
        created_at: new Date().toISOString(),
        archived: 0,
      };
      set((state) => ({
        tasks: [newTask, ...state.tasks],
        error: null,
      }));
      void recordAppEvent({
        eventName: "task_added",
        route: "/tasks",
        entityType: "task",
        entityId: id,
        metadata: {
          estimatedPomos,
          hasProject: Boolean(project?.trim()),
          hasPriority: Boolean(priority?.trim()),
          hasCategory: initialCategoryId != null,
          categoryId: initialCategoryId,
          hasSchedule: Boolean(scheduledFor),
          categoryInferred: false,
          categoryInferenceSource:
            initialCategoryId == null ? "none" : "manual",
          automaticCategorizationScheduled,
          aiCategorizationScheduled:
            automaticCategorizationScheduled && aiEnabled,
          aiCategorizationAttempted: false,
          aiCategorizationConfidence: null,
          aiCategorizationFailure: null,
          taskCreationWaitedForAi: false,
        },
      });

      if (automaticCategorizationScheduled) {
        window.setTimeout(() => {
          void categorizeTaskAfterCreation({
            taskId: id,
            name,
            project,
            expectedCategoryId: initialCategoryId,
            categoryName,
            aiEnabled,
          });
        }, 0);
      }
      return newTask;
    } catch (err) {
      console.error("[TaskStore] Failed to add task:", err);
      set({ error: String(err) });
      return null;
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
      const previousCategoryId = get().tasks.find((task) => task.id === id)
        ?.category_id ?? null;
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
          ...(categoryId !== undefined && {
            categoryChanged: previousCategoryId !== (categoryId ?? null),
            previousCategoryId,
            nextCategoryId: categoryId ?? null,
          }),
        },
      });
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
      void recordAppEvent({
        eventName: "task_deleted",
        route: "/tasks",
        entityType: "task",
        entityId: id,
      });
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
      await dbCompleteTask(id, safeActualPomos, review);
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
