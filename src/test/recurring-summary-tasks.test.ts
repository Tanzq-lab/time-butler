import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  addTask: vi.fn(),
  execute: vi.fn(),
  getDb: vi.fn(),
  select: vi.fn(),
}));

const pomodoroLogMocks = vi.hoisted(() => ({
  appendPomodoroEstimationLog: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  addTask: dbMocks.addTask,
  getDb: dbMocks.getDb,
}));

vi.mock("@/features/tasks/pomodoro-estimation-log", () => ({
  appendPomodoroEstimationLog: pomodoroLogMocks.appendPomodoroEstimationLog,
}));

import {
  buildSummaryTaskOccurrences,
  buildUserRecurringTaskOccurrences,
  ensureRecurringSummaryTasks,
  findFirstDayOffPeriodStartInMonth,
  isDayOff,
} from "@/features/tasks/recurring-summary-tasks";
import type { UserRecurringTaskRule } from "@/features/tasks/recurring-task-rules";

function userRule(
  overrides: Partial<UserRecurringTaskRule> = {},
): UserRecurringTaskRule {
  return {
    id: 12,
    name: "整理循环任务",
    estimated_pomos: 2,
    project: "时间管家",
    category_id: 50,
    category_name: "复盘计划",
    frequency: "daily",
    start_date: "2026-07-22",
    scheduled_time: "09:30",
    enabled: 1,
    created_at: "2026-07-22T08:00:00",
    updated_at: "2026-07-22T08:00:00",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMocks.getDb.mockResolvedValue({
    execute: dbMocks.execute,
    select: dbMocks.select,
  });
  dbMocks.select.mockImplementation(async (query: string) => {
    if (query.includes("FROM categories")) return [{ id: 69 }];
    return [];
  });
  dbMocks.execute.mockResolvedValue(undefined);
  pomodoroLogMocks.appendPomodoroEstimationLog.mockResolvedValue(undefined);

  let nextTaskId = 1;
  dbMocks.addTask.mockImplementation(async () => nextTaskId++);
});

describe("recurring summary tasks", () => {
  it("creates only today's occurrence for an active daily user rule", () => {
    const occurrences = buildUserRecurringTaskOccurrences(
      [userRule()],
      new Date(2026, 6, 22),
      7,
    );

    expect(occurrences).toEqual([
      expect.objectContaining({
        ruleKey: "custom.12",
        occurrenceDate: "2026-07-22",
        scheduledFor: "2026-07-22T09:30:00",
        categoryId: 50,
      }),
    ]);
  });

  it("uses the start date as the weekly cadence anchor", () => {
    const occurrences = buildUserRecurringTaskOccurrences(
      [userRule({ frequency: "weekly", start_date: "2026-07-24" })],
      new Date(2026, 6, 22),
      7,
    );

    expect(occurrences.map((item) => item.occurrenceDate)).toEqual([
      "2026-07-24",
    ]);
  });

  it("moves a monthly day 31 rule to the end of shorter months", () => {
    const occurrences = buildUserRecurringTaskOccurrences(
      [userRule({ frequency: "monthly", start_date: "2026-01-31" })],
      new Date(2026, 1, 22),
      7,
    );

    expect(occurrences.map((item) => item.occurrenceDate)).toEqual([
      "2026-02-28",
    ]);
  });

  it("creates one ANKI review for the reference day", () => {
    const occurrences = buildSummaryTaskOccurrences(
      new Date(2026, 6, 3),
      7,
    );

    expect(
      occurrences
        .filter((item) => item.ruleKey === "anki.daily")
        .map((item) => ({
          occurrenceDate: item.occurrenceDate,
          scheduledFor: item.scheduledFor,
          name: item.name,
          estimatedPomos: item.estimatedPomos,
          project: item.project,
          categoryName: item.categoryName,
        })),
    ).toEqual([
      {
        occurrenceDate: "2026-07-03",
        scheduledFor: "2026-07-03T09:00:00",
        name: "复习 ANKI",
        estimatedPomos: 1,
        project: "ANKI",
        categoryName: "记忆复习",
      },
    ]);
  });

  it("shares overlapping same-day generation to avoid duplicate tasks", async () => {
    await Promise.all([
      ensureRecurringSummaryTasks(new Date(2026, 6, 21)),
      ensureRecurringSummaryTasks(new Date(2026, 6, 21)),
    ]);

    // July 21 has one daily ANKI task and the following Monday's weekly summary.
    expect(dbMocks.addTask).toHaveBeenCalledTimes(2);
    expect(dbMocks.execute).toHaveBeenCalledTimes(2);
    expect(pomodoroLogMocks.appendPomodoroEstimationLog).toHaveBeenCalledTimes(2);
  });

  it("creates weekly summaries for Mondays in the next week", () => {
    const occurrences = buildSummaryTaskOccurrences(
      new Date(2026, 5, 28),
      7,
    );

    expect(
      occurrences
        .filter((item) => item.ruleKey === "summary.weekly")
        .map((item) => item.occurrenceDate),
    ).toEqual(["2026-06-29"]);
  });

  it("creates the monthly summary on the first day-off period start", () => {
    const occurrences = buildSummaryTaskOccurrences(
      new Date(2026, 5, 28),
      7,
    );

    expect(
      occurrences
        .filter((item) => item.ruleKey === "summary.monthly")
        .map((item) => item.occurrenceDate),
    ).toEqual(["2026-07-04"]);
  });

  it("does not treat a cross-month continuing weekend as the monthly holiday start", () => {
    expect(findFirstDayOffPeriodStartInMonth(2026, 10)).toBe("2026-11-07");
  });

  it("honors known 2026 make-up workdays and official off days", () => {
    expect(isDayOff(new Date(2026, 0, 1))).toBe(true);
    expect(isDayOff(new Date(2026, 0, 4))).toBe(false);
  });

  it("creates monthly and yearly summaries on the first holiday of the year", () => {
    const occurrences = buildSummaryTaskOccurrences(
      new Date(2025, 11, 26),
      7,
    );

    expect(
      occurrences
        .filter((item) =>
          ["summary.monthly", "summary.yearly"].includes(item.ruleKey),
        )
        .map((item) => `${item.ruleKey}:${item.occurrenceDate}`),
    ).toEqual(["summary.monthly:2026-01-01", "summary.yearly:2026-01-01"]);
  });

  it("uses fixed statutory holidays as a fallback for years without a maintained table", () => {
    const occurrences = buildSummaryTaskOccurrences(
      new Date(2026, 11, 25),
      7,
    );

    expect(
      occurrences
        .filter((item) =>
          ["summary.monthly", "summary.yearly"].includes(item.ruleKey),
        )
        .map((item) => `${item.ruleKey}:${item.occurrenceDate}`),
    ).toEqual(["summary.monthly:2027-01-01", "summary.yearly:2027-01-01"]);
  });
});
