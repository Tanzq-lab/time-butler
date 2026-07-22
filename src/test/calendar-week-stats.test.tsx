import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CalendarWeekStats } from "@/components/base/calendar-week-stats";
import type { CalendarEvent, WeekSummary } from "@/lib/db";

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

const calendarEvents: CalendarEvent[] = [
  {
    id: 1,
    title: "产品周会",
    starts_at: "2026-07-17 10:00:00",
    ends_at: "2026-07-17 11:30:00",
    notes: null,
    created_at: "2026-07-17 09:00:00",
    updated_at: "2026-07-17 09:00:00",
  },
];

describe("CalendarWeekStats", () => {
  it("keeps focus in pomodoros while showing other time separately", () => {
    render(<CalendarWeekStats summary={summary} calendarEvents={calendarEvents} />);

    expect(screen.getByText("完成番茄")).toBeVisible();
    expect(screen.getByText("12 个番茄")).toBeVisible();
    expect(screen.getByText("日均番茄")).toBeVisible();
    expect(screen.getByText("3.5 个番茄")).toBeVisible();
    expect(screen.getByText(/\(5 个番茄\)$/)).toBeVisible();
    expect(screen.getByText("其他时间")).toBeVisible();
    expect(screen.getByText("1 项 · 1小时30分钟")).toBeVisible();
  });
});
