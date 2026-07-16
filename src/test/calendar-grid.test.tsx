import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  CalendarGrid,
  computeDayLayout,
  formatTimeAtCalendarPosition,
} from "@/components/base/calendar-grid";
import type { WeekSession } from "@/lib/db";

function makeSession(
  id: number,
  startedAt: string,
  durationSec: number,
  phase = "work",
): WeekSession {
  return {
    id,
    task_id: id,
    task_name: `Task ${id}`,
    phase,
    started_at: startedAt,
    duration_sec: durationSec,
    completed: 1,
    pomo_counted: 1,
    category_id: null,
    category_name: null,
    category_color: null,
    intention: null,
    mood: null,
    notes: null,
  };
}

describe("computeDayLayout", () => {
  it("keeps sessions on the real time scale instead of stretching cards", () => {
    const layout = computeDayLayout(
      [
        makeSession(1, "2026-06-23 09:00:00", 25 * 60),
        makeSession(2, "2026-06-23 10:00:00", 25 * 60),
      ],
      6,
      22,
      72,
    );

    expect(layout.positioned[0].topPx).toBe(216);
    expect(layout.positioned[0].heightPx).toBe(30);
    expect(layout.positioned[1].topPx).toBe(288);
    expect(layout.positioned[1].heightPx).toBe(30);
  });

  it("labels sizeable idle gaps without changing the session positions", () => {
    const layout = computeDayLayout(
      [
        makeSession(1, "2026-06-23 09:00:00", 25 * 60),
        makeSession(2, "2026-06-23 10:00:00", 25 * 60),
      ],
      6,
      22,
      72,
    );

    expect(layout.idleGaps).toHaveLength(1);
    expect(layout.idleGaps[0].durationMin).toBe(35);
    expect(layout.idleGaps[0].topPx).toBe(246);
    expect(layout.idleGaps[0].heightPx).toBe(42);
  });

  it("leaves short pauses as plain whitespace", () => {
    const layout = computeDayLayout(
      [
        makeSession(1, "2026-06-23 09:00:00", 25 * 60),
        makeSession(2, "2026-06-23 09:35:00", 25 * 60),
      ],
      6,
      22,
      72,
    );

    expect(layout.idleGaps).toHaveLength(0);
    expect(layout.positioned[1].topPx).toBe(258);
  });

  it("uses a fixed hour grid height", () => {
    const layout = computeDayLayout([], 6, 22, 72);

    expect(layout.hourTopPx).toHaveLength(18);
    expect(layout.hourTopPx.at(-1)).toBe(1224);
    expect(layout.totalHeight).toBe(1224);
  });
});

describe("calendar hover time ruler", () => {
  it("converts the calendar position to a precise minute label", () => {
    expect(formatTimeAtCalendarPosition(0, 6, 72)).toBe("06:00");
    expect(formatTimeAtCalendarPosition(270, 6, 72)).toBe("09:45");
    expect(formatTimeAtCalendarPosition(1224, 6, 72)).toBe("23:00");
  });

  it("shows a ruler while the pointer is inside the desktop timeline and clears it on leave", () => {
    render(
      <CalendarGrid
        sessions={[]}
        weekDays={[new Date("2026-07-13T00:00:00")]}
        startHour={6}
        endHour={22}
        hourHeight={72}
      />,
    );

    const timeline = screen.getByTestId("calendar-desktop-timeline");
    expect(timeline).not.toHaveClass("overflow-y-auto");
    Object.defineProperty(timeline, "getBoundingClientRect", {
      value: () => ({ top: 100 }),
    });

    fireEvent.pointerMove(timeline, { clientY: 370 });
    expect(screen.getByTestId("calendar-hover-time-ruler")).toHaveAttribute(
      "aria-label",
      "悬浮时间 09:45",
    );

    fireEvent.pointerLeave(timeline);
    expect(screen.queryByTestId("calendar-hover-time-ruler")).not.toBeInTheDocument();
  });
});
