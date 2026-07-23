import { describe, expect, it, vi } from "vitest";
import {
  BUILT_IN_RECURRING_TASK_RULES,
  seedBuiltInRecurringTaskRules,
} from "@/lib/db/default-recurring-task-rules";

describe("built-in recurring rule seeds", () => {
  it("seeds stable editable rule keys with their original schedules", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const select = vi.fn().mockResolvedValue([
      { id: 50, name: "检查复盘" },
      { id: 51, name: "记忆复习" },
    ]);

    await seedBuiltInRecurringTaskRules({ execute, select });

    expect(execute).toHaveBeenCalledTimes(4);
    expect(BUILT_IN_RECURRING_TASK_RULES.map((rule) => rule.ruleKey)).toEqual([
      "summary.weekly",
      "summary.monthly",
      "summary.yearly",
      "anki.daily",
    ]);
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT OR IGNORE INTO recurring_task_rules"),
      [
        "summary.monthly",
        "月总结",
        2,
        "个人复盘",
        50,
        "monthly",
        "monthly_first_day_off",
        "2026-01-01",
        "09:00",
      ],
    );
  });
});
