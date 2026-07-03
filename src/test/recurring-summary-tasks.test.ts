import { describe, expect, it } from "vitest";
import {
  buildSummaryTaskOccurrences,
  findFirstDayOffPeriodStartInMonth,
  isDayOff,
} from "@/features/tasks/recurring-summary-tasks";

describe("recurring summary tasks", () => {
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

  it("creates weekly summaries for Sundays in the next week", () => {
    const occurrences = buildSummaryTaskOccurrences(
      new Date(2026, 5, 28),
      7,
    );

    expect(
      occurrences
        .filter((item) => item.ruleKey === "summary.weekly")
        .map((item) => item.occurrenceDate),
    ).toEqual(["2026-06-28", "2026-07-05"]);
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
