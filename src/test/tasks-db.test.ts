import { beforeEach, describe, expect, it, vi } from "vitest";
import { addTask, getTasks, reorderTasks, updateTask } from "@/lib/db/tasks";
import { getDb } from "@/lib/db/schema";

vi.mock("@/lib/db/schema", () => ({
  getDb: vi.fn(),
}));

const execute = vi.fn();
const select = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDb).mockResolvedValue({ execute, select } as never);
  execute.mockResolvedValue({ lastInsertId: 9 });
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
      expect.stringContaining("COALESCE((SELECT MIN(sort_order) FROM tasks WHERE archived = 0), 0) - 1"),
      ["新任务", 2, null, null, null, null],
    );
  });

  it("reads persisted task order and saves a requested order", async () => {
    await getTasks();
    expect(select).toHaveBeenCalledWith(
      "SELECT * FROM tasks WHERE archived = 0 ORDER BY sort_order ASC, created_at DESC",
    );

    await reorderTasks([7, 3]);
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining("SET sort_order = CASE id WHEN $1 THEN $2 WHEN $3 THEN $4"),
      [7, 0, 3, 1],
    );
  });
});
