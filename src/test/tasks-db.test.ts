import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addTask,
  addTodoTask,
  getTaskCompletionReviews,
  getTasks,
  reorderTasks,
  setTaskCompleted,
  setTaskItemType,
  updateTask,
} from "@/lib/db/tasks";
import { getDb } from "@/lib/db/schema";

vi.mock("@/lib/db/schema", () => ({
  getDb: vi.fn(),
}));

const execute = vi.fn();
const select = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDb).mockResolvedValue({ execute, select } as never);
  execute.mockResolvedValue({ lastInsertId: 9, rowsAffected: 1 });
  select.mockResolvedValue([]);
});

describe("task database boundaries", () => {
  it("accepts only whole estimates from one through four", async () => {
    await expect(addTask("过大任务", 5)).rejects.toThrow("预计番茄数必须是 1 到 4 的整数");
    await expect(addTask("零番茄", 0)).rejects.toThrow("预计番茄数必须是 1 到 4 的整数");
    await expect(updateTask(9, undefined, 2.5)).rejects.toThrow(
      "预计番茄数必须是 1 到 4 的整数",
    );
    expect(getDb).not.toHaveBeenCalled();
  });

  it("places a newly created task ahead of the current visible order", async () => {
    await addTask("新任务", 2);

    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining("AND parent_id IS $7"),
      ["新任务", 2, null, null, null, null, null],
    );
  });

  it("adds a trimmed todo in its sibling scope and reopens its parent", async () => {
    await addTodoTask("  完成界面验收  ", 12);

    expect(execute).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("'todo'"),
      ["完成界面验收", 12, null, null, null],
    );
    expect(execute).toHaveBeenNthCalledWith(
      2,
      "UPDATE tasks SET completed_at = NULL WHERE id = $1",
      [12],
    );
  });

  it("keeps recurring metadata when it creates a todo", async () => {
    await addTodoTask("每日整理收件箱", null, {
      project: "个人效率",
      categoryId: 50,
      scheduledFor: "2026-07-29T09:00:00",
    });

    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining("scheduled_for"),
      [
        "每日整理收件箱",
        null,
        "个人效率",
        50,
        "2026-07-29T09:00:00",
      ],
    );
  });

  it("converts task type in place and validates focus estimates", async () => {
    await setTaskItemType(8, "focus", 3);
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining("SET item_type = 'focus'"),
      [8, 3],
    );

    await setTaskItemType(8, "todo");
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining("AND completed_pomos = 0"),
      [8],
    );

    await expect(setTaskItemType(8, "focus", 5)).rejects.toThrow(
      "预计番茄数必须是 1 到 4 的整数",
    );
  });

  it("rejects focus-to-todo conversion after pomodoros are recorded", async () => {
    execute.mockResolvedValueOnce({ rowsAffected: 0 });

    await expect(setTaskItemType(8, "todo")).rejects.toThrow(
      "已产生番茄记录的专注任务不能转为待办",
    );
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining("AND completed_pomos = 0"),
      [8],
    );
  });

  it("derives parent completion from all visible children", async () => {
    select
      .mockResolvedValueOnce([{ parent_id: 12 }])
      .mockResolvedValueOnce([
        { id: 13, completed_at: "2026-07-28 12:00:00" },
        { id: 14, completed_at: "2026-07-28 12:01:00" },
      ]);

    await expect(setTaskCompleted(13, true)).resolves.toBe(12);
    expect(execute).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("SET completed_at = CASE"),
      [13, 1],
    );
    expect(execute).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("WHERE id = $1"),
      [12, 1],
    );
  });

  it("reads persisted task order and saves a requested order", async () => {
    await getTasks();
    expect(select).toHaveBeenCalledWith(
      expect.stringContaining("CASE WHEN parent_id IS NULL THEN 0 ELSE 1 END"),
    );

    await reorderTasks([7, 3]);
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining("SET sort_order = CASE id WHEN $1 THEN $2 WHEN $3 THEN $4"),
      [7, 0, 3, 1, null],
    );
  });

  it("loads a task's completion history newest first", async () => {
    const history = [
      {
        id: 3,
        task_id: 7,
        estimated_pomos: 2,
        actual_pomos: 3,
        review: "联调增加了工作量。",
        completed_at: "2026-07-29 12:00:00",
      },
    ];
    select.mockResolvedValueOnce(history);

    await expect(getTaskCompletionReviews(7)).resolves.toEqual(history);
    expect(select).toHaveBeenCalledWith(
      expect.stringContaining("ORDER BY completed_at DESC, id DESC"),
      [7],
    );
  });
});
