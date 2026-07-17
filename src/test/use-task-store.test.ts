import { describe, it, expect, vi, beforeEach } from "vitest";
import { useTaskStore } from "@/features/tasks/use-task-store";
import { useSettingsStore } from "@/features/settings/use-settings-store";
import { appendPomodoroEstimationLog } from "@/features/tasks/pomodoro-estimation-log";
import { ensureRecurringSummaryTasks } from "@/features/tasks/recurring-summary-tasks";

const { classifyTaskCategoryMock } = vi.hoisted(() => ({
  classifyTaskCategoryMock: vi.fn(),
}));

vi.mock("@/lib/ai-category", () => ({
  classifyTaskCategory: classifyTaskCategoryMock,
}));

const mockTasks = [
  {
    id: 1,
    name: "Task A",
    estimated_pomos: 3,
    completed_pomos: 1,
    category_id: null,
    created_at: "2026-01-01T00:00:00",
    archived: 0,
  },
  {
    id: 2,
    name: "Task B",
    project: "Work",
    priority: "high" as const,
    estimated_pomos: 5,
    completed_pomos: 5,
    category_id: 1,
    created_at: "2026-01-02T00:00:00",
    archived: 0,
  },
];

vi.mock("@/lib/db", () => ({
  getTasks: vi.fn().mockResolvedValue([
    {
      id: 1,
      name: "Task A",
      estimated_pomos: 3,
      completed_pomos: 1,
      category_id: null,
      created_at: "2026-01-01T00:00:00",
      archived: 0,
    },
    {
      id: 2,
      name: "Task B",
      project: "Work",
      priority: "high",
      estimated_pomos: 5,
      completed_pomos: 5,
      category_id: 1,
      created_at: "2026-01-02T00:00:00",
      archived: 0,
    },
  ]),
  addTask: vi.fn().mockResolvedValue(3),
  updateTask: vi.fn().mockResolvedValue(undefined),
  updateTaskCategoryIfUnchanged: vi.fn().mockResolvedValue(true),
  deleteTask: vi.fn().mockResolvedValue(undefined),
  toggleTaskArchived: vi.fn().mockResolvedValue(undefined),
  incrementTaskPomos: vi.fn().mockResolvedValue(undefined),
  completeTask: vi.fn().mockResolvedValue(undefined),
  appendTaskNote: vi.fn().mockResolvedValue("**2026-07-16 15:30**\n\n记录的卡点"),
  getCategories: vi.fn().mockResolvedValue([
    {
      id: 69,
      name: "记忆复习",
      color: "#A06C75",
      created_at: "2026-01-01T00:00:00",
    },
    {
      id: 63,
      name: "写作输出",
      color: "#B08968",
      created_at: "2026-01-01T00:00:00",
    },
  ]),
  getSetting: vi.fn().mockResolvedValue("true"),
  setSetting: vi.fn().mockResolvedValue(undefined),
  recordAppEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/features/tasks/pomodoro-estimation-log", () => ({
  appendPomodoroEstimationLog: vi.fn().mockResolvedValue(undefined),
  buildCompletionLogEntry: vi.fn(
    (
      task: {
        name: string;
        estimated_pomos: number;
        completed_pomos: number;
      },
      review?: string,
    ) => {
      const delta = task.completed_pomos - task.estimated_pomos;
      if (delta === 0) return null;

      return {
        event: "completion",
        completedAt: "2026-06-22T00:00:00.000Z",
        taskName: task.name,
        estimatedPomos: task.estimated_pomos,
        actualPomos: task.completed_pomos,
        delta,
        lesson: review || "actual differed from estimate",
      };
    },
  ),
}));

vi.mock("@/features/tasks/recurring-summary-tasks", () => ({
  ensureRecurringSummaryTasks: vi.fn().mockResolvedValue(0),
}));

beforeEach(async () => {
  vi.clearAllMocks();
  useTaskStore.setState({ tasks: [], loading: false, error: null });
  useSettingsStore.setState((state) => ({
    settings: { ...state.settings, aiAutoCategorization: false },
  }));
});

describe("useTaskStore", () => {
  describe("initial state", () => {
    it("has correct defaults", () => {
      const state = useTaskStore.getState();
      expect(state.tasks).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe("loadTasks", () => {
    it("loads tasks from db", async () => {
      await useTaskStore.getState().loadTasks();
      const state = useTaskStore.getState();
      expect(state.tasks).toHaveLength(2);
      expect(state.tasks[0].name).toBe("Task A");
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(ensureRecurringSummaryTasks).toHaveBeenCalledTimes(1);
    });

    it("sets loading true during fetch", async () => {
      const promise = useTaskStore.getState().loadTasks();
      expect(useTaskStore.getState().loading).toBe(true);
      await promise;
      expect(useTaskStore.getState().loading).toBe(false);
    });
  });

  describe("addTask", () => {
    it("optimistically prepends new task to list", async () => {
      useTaskStore.setState({ tasks: [...mockTasks] });
      await useTaskStore.getState().addTask("New Task", 2, "Project");
      const state = useTaskStore.getState();
      expect(state.tasks).toHaveLength(3);
      expect(state.tasks[0].name).toBe("New Task");
      expect(state.tasks[0].estimated_pomos).toBe(2);
      expect(state.tasks[0].completed_pomos).toBe(0);
      expect(state.tasks[0].project).toBe("Project");
    });

    it("infers category when manual task category is empty", async () => {
      const {
        addTask: dbAddTask,
        updateTaskCategoryIfUnchanged,
      } = await import("@/lib/db");
      useTaskStore.setState({ tasks: [...mockTasks] });

      const task = await useTaskStore
        .getState()
        .addTask("背诵：赛车 UGC 的产品内核是什么？", 2);

      expect(task?.category_id).toBeNull();
      expect(dbAddTask).toHaveBeenLastCalledWith(
        "背诵：赛车 UGC 的产品内核是什么？",
        2,
        undefined,
        undefined,
        null,
        undefined,
      );
      await vi.waitFor(() =>
        expect(updateTaskCategoryIfUnchanged).toHaveBeenCalledWith(3, null, 69),
      );
      expect(useTaskStore.getState().tasks[0].category_id).toBe(69);
    });

    it("keeps explicit manual category over inferred category", async () => {
      const { addTask: dbAddTask } = await import("@/lib/db");
      useTaskStore.setState({ tasks: [...mockTasks] });

      await useTaskStore
        .getState()
        .addTask("背诵：赛车 UGC 的产品内核是什么？", 2, "", "", 63);

      expect(dbAddTask).toHaveBeenLastCalledWith(
        "背诵：赛车 UGC 的产品内核是什么？",
        2,
        "",
        "",
        63,
        undefined,
      );
      expect(useTaskStore.getState().tasks[0].category_id).toBe(63);
      expect(classifyTaskCategoryMock).not.toHaveBeenCalled();
      const { updateTaskCategoryIfUnchanged } = await import("@/lib/db");
      expect(updateTaskCategoryIfUnchanged).not.toHaveBeenCalled();
    });

    it("creates immediately and applies sufficient AI classification in the background", async () => {
      const {
        addTask: dbAddTask,
        updateTaskCategoryIfUnchanged,
      } = await import("@/lib/db");
      useTaskStore.setState({ tasks: [...mockTasks] });
      useSettingsStore.setState((state) => ({
        settings: { ...state.settings, aiAutoCategorization: true },
      }));
      let resolveClassification: (value: {
        categoryId: number;
        confidence: "high";
      }) => void = () => undefined;
      classifyTaskCategoryMock.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveClassification = resolve;
        }),
      );

      const task = await useTaskStore
        .getState()
        .addTask("把访谈记录整理成发布稿", 2, "Time Butler");

      expect(task?.category_id).toBeNull();
      expect(dbAddTask).toHaveBeenLastCalledWith(
        "把访谈记录整理成发布稿",
        2,
        "Time Butler",
        undefined,
        null,
        undefined,
      );
      expect(updateTaskCategoryIfUnchanged).not.toHaveBeenCalled();

      await vi.waitFor(() =>
        expect(classifyTaskCategoryMock).toHaveBeenCalledWith({
          taskName: "把访谈记录整理成发布稿",
          project: "Time Butler",
          categories: [
            { id: 69, name: "记忆复习" },
            { id: 63, name: "写作输出" },
          ],
        }),
      );
      expect(useTaskStore.getState().tasks[0].category_id).toBeNull();

      resolveClassification({ categoryId: 63, confidence: "high" });
      await vi.waitFor(() =>
        expect(updateTaskCategoryIfUnchanged).toHaveBeenCalledWith(3, null, 63),
      );
      expect(useTaskStore.getState().tasks[0].category_id).toBe(63);
    });

    it("falls back to local rules when AI classification fails", async () => {
      const {
        addTask: dbAddTask,
        updateTaskCategoryIfUnchanged,
      } = await import("@/lib/db");
      useTaskStore.setState({ tasks: [...mockTasks] });
      useSettingsStore.setState((state) => ({
        settings: { ...state.settings, aiAutoCategorization: true },
      }));
      classifyTaskCategoryMock.mockRejectedValueOnce(new Error("network_error"));

      const task = await useTaskStore
        .getState()
        .addTask("背诵产品内核", 1);

      expect(task).not.toBeNull();
      expect(task?.category_id).toBeNull();
      expect(dbAddTask).toHaveBeenLastCalledWith(
        "背诵产品内核",
        1,
        undefined,
        undefined,
        null,
        undefined,
      );
      await vi.waitFor(() =>
        expect(updateTaskCategoryIfUnchanged).toHaveBeenCalledWith(3, null, 69),
      );
      expect(useTaskStore.getState().tasks[0].category_id).toBe(69);
    });

    it("does not overwrite a category changed while AI is pending", async () => {
      const { updateTaskCategoryIfUnchanged } = await import("@/lib/db");
      vi.mocked(updateTaskCategoryIfUnchanged).mockResolvedValueOnce(false);
      useTaskStore.setState({ tasks: [...mockTasks] });
      useSettingsStore.setState((state) => ({
        settings: { ...state.settings, aiAutoCategorization: true },
      }));
      let resolveClassification: (value: {
        categoryId: number;
        confidence: "high";
      }) => void = () => undefined;
      classifyTaskCategoryMock.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveClassification = resolve;
        }),
      );

      await useTaskStore.getState().addTask("整理访谈记录", 1);
      await vi.waitFor(() =>
        expect(classifyTaskCategoryMock).toHaveBeenCalledTimes(1),
      );
      useTaskStore.setState((state) => ({
        tasks: state.tasks.map((task) =>
          task.id === 3 ? { ...task, category_id: 69 } : task,
        ),
      }));

      resolveClassification({ categoryId: 63, confidence: "high" });
      await vi.waitFor(() =>
        expect(updateTaskCategoryIfUnchanged).toHaveBeenCalledWith(3, null, 63),
      );
      expect(useTaskStore.getState().tasks[0].category_id).toBe(69);
    });

    it("sets error on failure", async () => {
      const { addTask } = await import("@/lib/db");
      vi.mocked(addTask).mockRejectedValueOnce(new Error("DB error"));
      await useTaskStore.getState().addTask("Fail", 1);
      expect(useTaskStore.getState().error).toBe("Error: DB error");
    });
  });

  describe("updateTask", () => {
    it("optimistically updates task fields", async () => {
      useTaskStore.setState({ tasks: [...mockTasks] });
      await useTaskStore.getState().updateTask(1, "Updated Name", 10);
      const state = useTaskStore.getState();
      const updated = state.tasks.find((t) => t.id === 1)!;
      expect(updated.name).toBe("Updated Name");
      expect(updated.estimated_pomos).toBe(10);
      expect(updated.completed_pomos).toBe(1);
    });

    it("does not change fields that are undefined", async () => {
      useTaskStore.setState({ tasks: [...mockTasks] });
      await useTaskStore.getState().updateTask(1, undefined, undefined, "NewProject");
      const updated = useTaskStore.getState().tasks.find((t) => t.id === 1)!;
      expect(updated.name).toBe("Task A");
      expect(updated.project).toBe("NewProject");
    });
  });

  describe("deleteTask", () => {
    it("optimistically removes task", async () => {
      useTaskStore.setState({ tasks: [...mockTasks] });
      await useTaskStore.getState().deleteTask(1);
      expect(useTaskStore.getState().tasks).toHaveLength(1);
      expect(useTaskStore.getState().tasks[0].id).toBe(2);
    });

    it("sets error on failure", async () => {
      const { deleteTask } = await import("@/lib/db");
      vi.mocked(deleteTask).mockRejectedValueOnce(new Error("DB error"));
      useTaskStore.setState({ tasks: [...mockTasks] });
      await useTaskStore.getState().deleteTask(1);
      expect(useTaskStore.getState().error).toBe("Error: DB error");
    });
  });

  describe("archiveTask", () => {
    it("optimistically removes task from list", async () => {
      useTaskStore.setState({ tasks: [...mockTasks] });
      await useTaskStore.getState().archiveTask(2);
      expect(useTaskStore.getState().tasks).toHaveLength(1);
      expect(useTaskStore.getState().tasks[0].id).toBe(1);
    });
  });

  describe("incrementPomos", () => {
    it("optimistically increments completed_pomos", async () => {
      useTaskStore.setState({ tasks: [...mockTasks] });
      await useTaskStore.getState().incrementPomos(1);
      const updated = useTaskStore.getState().tasks.find((t) => t.id === 1)!;
      expect(updated.completed_pomos).toBe(2);
    });

    it("does not affect other tasks", async () => {
      useTaskStore.setState({ tasks: [...mockTasks] });
      await useTaskStore.getState().incrementPomos(1);
      const other = useTaskStore.getState().tasks.find((t) => t.id === 2)!;
      expect(other.completed_pomos).toBe(5);
    });

    it("reflects a session credit without incrementing the database twice", async () => {
      const { incrementTaskPomos } = await import("@/lib/db");
      useTaskStore.setState({ tasks: [...mockTasks] });

      await useTaskStore.getState().incrementPomos(1, undefined, {
        alreadyPersisted: true,
        sessionId: 514,
      });

      expect(incrementTaskPomos).not.toHaveBeenCalled();
      expect(useTaskStore.getState().tasks[0].completed_pomos).toBe(2);
    });

    it("logs completion estimate delta on the first overrun", async () => {
      useTaskStore.setState({
        tasks: [
          {
            id: 3,
            name: "Underestimated task",
            estimated_pomos: 2,
            completed_pomos: 2,
            category_id: null,
            created_at: "2026-01-03T00:00:00",
            archived: 0,
          },
        ],
      });

      await useTaskStore.getState().incrementPomos(3);

      expect(appendPomodoroEstimationLog).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "completion",
          taskName: "Underestimated task",
          estimatedPomos: 2,
          actualPomos: 3,
          delta: 1,
        }),
      );
    });

    it("does not log completion delta when actual pomos match estimate", async () => {
      useTaskStore.setState({
        tasks: [
          {
            id: 4,
            name: "Accurate task",
            estimated_pomos: 2,
            completed_pomos: 1,
            category_id: null,
            created_at: "2026-01-04T00:00:00",
            archived: 0,
          },
        ],
      });

      await useTaskStore.getState().incrementPomos(4);

      expect(appendPomodoroEstimationLog).not.toHaveBeenCalled();
    });
  });

  describe("completeTask", () => {
    it("marks a task completed early and logs the review reason", async () => {
      useTaskStore.setState({
        tasks: [
          {
            id: 5,
            name: "Early task",
            estimated_pomos: 4,
            completed_pomos: 2,
            category_id: null,
            created_at: "2026-01-05T00:00:00",
            archived: 0,
          },
        ],
      });

      await useTaskStore
        .getState()
        .completeTask(5, 2, "需求比预期简单，提前完成。");

      const updated = useTaskStore.getState().tasks.find((t) => t.id === 5)!;
      expect(updated.completed_pomos).toBe(2);
      expect(updated.completed_at).toBeTruthy();
      expect(updated.completion_review).toBe("需求比预期简单，提前完成。");
      expect(appendPomodoroEstimationLog).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "completion",
          taskName: "Early task",
          estimatedPomos: 4,
          actualPomos: 2,
          delta: -2,
          lesson: "需求比预期简单，提前完成。",
        }),
      );
    });

    it("does not log completion review when actual pomos match estimate", async () => {
      useTaskStore.setState({
        tasks: [
          {
            id: 6,
            name: "Accurate completed task",
            estimated_pomos: 2,
            completed_pomos: 1,
            category_id: null,
            created_at: "2026-01-06T00:00:00",
            archived: 0,
          },
        ],
      });

      await useTaskStore.getState().completeTask(6, 2, "");

      const updated = useTaskStore.getState().tasks.find((t) => t.id === 6)!;
      expect(updated.completed_pomos).toBe(2);
      expect(updated.completed_at).toBeTruthy();
      expect(appendPomodoroEstimationLog).not.toHaveBeenCalled();
    });
  });

  describe("appendTaskNote", () => {
    it("updates the task note without replacing the rest of the task", async () => {
      const { appendTaskNote } = await import("@/lib/db");
      useTaskStore.setState({ tasks: [...mockTasks] });

      const saved = await useTaskStore
        .getState()
        .appendTaskNote(1, "记录的卡点", "task-card");

      expect(saved).toBe(true);
      expect(appendTaskNote).toHaveBeenCalledWith(1, "记录的卡点");
      expect(useTaskStore.getState().tasks[0]).toMatchObject({
        id: 1,
        name: "Task A",
        notes: "**2026-07-16 15:30**\n\n记录的卡点",
      });
    });

    it("only records non-sensitive capture metadata", async () => {
      const { recordAppEvent } = await import("@/lib/db");
      useTaskStore.setState({ tasks: [...mockTasks] });

      await useTaskStore
        .getState()
        .appendTaskNote(1, "不要写入埋点的内容", "timer");

      expect(recordAppEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: "task_note_appended",
          route: "/",
          entityId: 1,
          metadata: {
            source: "timer",
            characterCount: 9,
          },
        }),
      );
    });
  });
});
