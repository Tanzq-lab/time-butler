import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CalendarWeekStats } from "@/components/base/calendar-week-stats";
import type { WeekSummary } from "@/lib/db";

const summary: WeekSummary = {
  total_seconds: 9000,
  total_sessions: 14,
  work_sessions: 12,
  break_sessions: 2,
  avg_daily_seconds: 3000,
  completed_pomos: 12,
  avg_daily_pomos: 3.5,
  peak_day: "2026-07-17",
  peak_day_seconds: 3750,
  peak_day_pomos: 5,
};

describe("CalendarWeekStats", () => {
  it("uses completed pomodoros, not duration, as the calendar's summary measure", () => {
    render(<CalendarWeekStats summary={summary} />);

    expect(screen.getByText("完成番茄")).toBeVisible();
    expect(screen.getByText("12 个番茄")).toBeVisible();
    expect(screen.getByText("日均番茄")).toBeVisible();
    expect(screen.getByText("3.5 个番茄")).toBeVisible();
    expect(screen.getByText(/\(5 个番茄\)$/)).toBeVisible();
    expect(screen.queryByText(/小时|分钟/)).not.toBeInTheDocument();
  });
});
