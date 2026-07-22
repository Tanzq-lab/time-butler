import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  execute: vi.fn(),
  getDb: vi.fn(),
  select: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: dbMocks.getDb,
}));

import {
  addRecurringTaskRule,
  getEnabledRecurringTaskRules,
  setRecurringTaskRuleEnabled,
} from "@/features/tasks/recurring-task-rules";

beforeEach(() => {
  vi.clearAllMocks();
  dbMocks.getDb.mockResolvedValue({
    execute: dbMocks.execute,
    select: dbMocks.select,
  });
  dbMocks.execute.mockResolvedValue({ lastInsertId: 31 });
  dbMocks.select.mockResolvedValue([]);
});

describe("recurring task rules database", () => {
  it("persists a normalized rule without mixing project and category", async () => {
    await expect(
      addRecurringTaskRule({
        name: "  每日整理收件箱  ",
        estimatedPomos: 1,
        project: " 个人效率 ",
        categoryId: 66,
        frequency: "daily",
        startDate: "2026-07-22",
        scheduledTime: "09:00",
      }),
    ).resolves.toBe(31);

    expect(dbMocks.execute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO recurring_task_rules"),
      [
        "每日整理收件箱",
        1,
        "个人效率",
        66,
        "daily",
        "2026-07-22",
        "09:00",
      ],
    );
  });

  it("rejects invalid estimates before touching the database", async () => {
    await expect(
      addRecurringTaskRule({
        name: "过大的任务",
        estimatedPomos: 5,
        project: null,
        categoryId: null,
        frequency: "weekly",
        startDate: "2026-07-22",
        scheduledTime: "09:00",
      }),
    ).rejects.toThrow("预计番茄数必须是 1 到 4 的整数");
    expect(dbMocks.getDb).not.toHaveBeenCalled();
  });

  it("loads only enabled rules with their category name", async () => {
    await getEnabledRecurringTaskRules();

    expect(dbMocks.select).toHaveBeenCalledWith(
      expect.stringContaining("WHERE recurring_task_rules.enabled = 1"),
    );
  });

  it("soft-disables a rule so the change remains reversible", async () => {
    await setRecurringTaskRuleEnabled(31, false);

    expect(dbMocks.execute).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE recurring_task_rules"),
      [0, 31],
    );
  });
});
