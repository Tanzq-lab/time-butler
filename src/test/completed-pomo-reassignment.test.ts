import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  execute: vi.fn(),
  select: vi.fn(),
}));
const getDb = vi.hoisted(() => vi.fn(async () => database));
const getDbName = vi.hoisted(() => vi.fn(async () => "sqlite:/tmp/Time-butler.db"));
const invoke = vi.hoisted(() => vi.fn());
const isTauri = vi.hoisted(() => vi.fn(() => false));

vi.mock("@/lib/db/schema", () => ({ getDb, getDbName }));
vi.mock("@/lib/tauri", () => ({ invoke, isTauri }));

import { reassignCompletedPomo } from "@/lib/db/sessions";

describe("reassignCompletedPomo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isTauri.mockReturnValue(false);
    database.select.mockResolvedValue([
      {
        source_task_id: 12,
        source_category_id: 48,
        target_category_id: 69,
      },
    ]);
    database.execute.mockImplementation(async (sql: string) => ({
      rowsAffected: sql.includes("UPDATE sessions") ? 1 : 0,
    }));
  });

  it("uses the native transaction instead of issuing transaction SQL through the pool", async () => {
    isTauri.mockReturnValue(true);
    invoke.mockResolvedValueOnce({
      sourceTaskId: 12,
      sourceCategoryId: 48,
      targetTaskId: 13,
      targetCategoryId: 69,
    });

    await expect(reassignCompletedPomo(93, 13)).resolves.toEqual({
      sourceTaskId: 12,
      sourceCategoryId: 48,
      targetTaskId: 13,
      targetCategoryId: 69,
    });

    expect(invoke).toHaveBeenCalledWith("reassign_completed_pomo", {
      db: "sqlite:/tmp/Time-butler.db",
      sessionId: 93,
      targetTaskId: 13,
    });
    expect(database.execute).not.toHaveBeenCalled();
  });

  it("keeps manual transaction statements out of the browser SQL fallback", async () => {
    const result = await reassignCompletedPomo(93, 13);

    expect(result).toEqual({
      sourceTaskId: 12,
      sourceCategoryId: 48,
      targetTaskId: 13,
      targetCategoryId: 69,
    });
    expect(database.execute).not.toHaveBeenCalledWith("BEGIN IMMEDIATE");
    expect(database.execute).not.toHaveBeenCalledWith("COMMIT");
    expect(database.execute).not.toHaveBeenCalledWith("ROLLBACK");
    expect(database.execute).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE sessions"),
      [93, 13, 69, 12],
    );
    expect(database.execute).toHaveBeenCalledWith(
      expect.stringContaining("completed_pomos = MAX(0, completed_pomos - 1)"),
      [12],
    );
    expect(database.execute).toHaveBeenCalledWith(
      expect.stringContaining("completed_pomos = completed_pomos + 1"),
      [13],
    );
  });

  it("turns a native command rejection into a visible Error message", async () => {
    isTauri.mockReturnValue(true);
    invoke.mockRejectedValueOnce("数据库事务失败，请重试。");

    await expect(reassignCompletedPomo(93, 13)).rejects.toThrow(
      "数据库事务失败，请重试。",
    );
  });

  it("rejects a session that is not eligible for correction", async () => {
    database.select.mockResolvedValue([]);

    await expect(reassignCompletedPomo(93, 13)).rejects.toThrow(
      "只能更正已完成且已计入任务的专注番茄。",
    );

    expect(database.execute).not.toHaveBeenCalledWith("ROLLBACK");
    expect(database.execute).not.toHaveBeenCalledWith(
      expect.stringContaining("UPDATE sessions"),
      expect.anything(),
    );
  });
});
