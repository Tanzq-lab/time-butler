import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  execute: vi.fn(),
  select: vi.fn(),
}));
const getDb = vi.hoisted(() => vi.fn(async () => database));

vi.mock("@/lib/db/schema", () => ({ getDb }));

import { reassignCompletedPomo } from "@/lib/db/sessions";

describe("reassignCompletedPomo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("moves the completed session and both task counters in one transaction", async () => {
    const result = await reassignCompletedPomo(93, 13);

    expect(result).toEqual({
      sourceTaskId: 12,
      sourceCategoryId: 48,
      targetTaskId: 13,
      targetCategoryId: 69,
    });
    expect(database.execute).toHaveBeenNthCalledWith(1, "BEGIN IMMEDIATE");
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
    expect(database.execute).toHaveBeenCalledWith("COMMIT");
  });

  it("rolls back when the session is not eligible for correction", async () => {
    database.select.mockResolvedValue([]);

    await expect(reassignCompletedPomo(93, 13)).rejects.toThrow(
      "只能更正已完成且已计入任务的专注番茄。",
    );

    expect(database.execute).toHaveBeenCalledWith("ROLLBACK");
    expect(database.execute).not.toHaveBeenCalledWith(
      expect.stringContaining("UPDATE sessions"),
      expect.anything(),
    );
  });
});
