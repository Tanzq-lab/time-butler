import { beforeEach, describe, expect, it, vi } from "vitest";
const database = vi.hoisted(() => ({
  execute: vi.fn(),
  select: vi.fn(),
}));
const getDb = vi.hoisted(() => vi.fn(async () => database));

vi.mock("@/lib/db/schema", () => ({
  getDb,
}));

import { appendTaskNote } from "@/lib/db/tasks";

describe("appendTaskNote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("atomically appends a timestamped entry and returns the persisted note", async () => {
    database.execute.mockResolvedValue(undefined);
    database.select.mockResolvedValue([
      { notes: "旧记录\n\n**2026-07-16 15:45**\n\n新的卡点" },
    ]);

    await expect(
      appendTaskNote(3, "新的卡点", new Date(2026, 6, 16, 15, 45)),
    ).resolves.toBe("旧记录\n\n**2026-07-16 15:45**\n\n新的卡点");

    expect(database.execute).toHaveBeenCalledWith(
      expect.stringContaining("ELSE notes || char(10) || char(10) || $2"),
      [3, "**2026-07-16 15:45**\n\n新的卡点"],
    );
  });

  it("rejects an empty record before writing", async () => {
    await expect(appendTaskNote(3, "   ")).rejects.toThrow("记录内容不能为空");
    expect(database.execute).not.toHaveBeenCalled();
  });
});
