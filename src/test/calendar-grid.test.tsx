import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  CalendarGrid,
  computeDayLayout,
  formatTimeAtCalendarPosition,
  getCalendarSelectionPosition,
} from "@/components/base/calendar-grid";
import type { CalendarEvent, WeekSession } from "@/lib/db";

beforeEach(() => {
  window.sessionStorage.clear();
});

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

function makeEvent(
  id: number,
  startsAt: string,
  endsAt: string,
): CalendarEvent {
  return {
    id,
    title: `Event ${id}`,
    starts_at: startsAt,
    ends_at: endsAt,
    notes: null,
    created_at: startsAt,
    updated_at: startsAt,
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

  it("treats calendar events as occupied time without turning them into focus sessions", () => {
    const layout = computeDayLayout(
      [makeSession(1, "2026-06-23 09:00:00", 25 * 60)],
      6,
      22,
      72,
      [makeEvent(2, "2026-06-23 10:00:00", "2026-06-23 11:00:00")],
    );

    expect(layout.positioned).toHaveLength(1);
    expect(layout.positionedEvents).toHaveLength(1);
    expect(layout.positionedEvents[0]).toMatchObject({ topPx: 288, heightPx: 72 });
    expect(layout.idleGaps).toHaveLength(1);
    expect(layout.idleGaps[0].durationMin).toBe(35);
  });
});

describe("calendar drag selection", () => {
  it("snaps both edges to 15-minute increments", () => {
    const selection = getCalendarSelectionPosition(221, 315, 1224, 6, 72);

    expect(selection).toEqual({
      topPx: 216,
      heightPx: 108,
      startMinutes: 540,
      endMinutes: 630,
    });
  });

  it("gives a click a useful 30-minute default without leaving the timeline", () => {
    expect(getCalendarSelectionPosition(1224, 1224, 1224, 6, 72, 30)).toEqual({
      topPx: 1188,
      heightPx: 36,
      startMinutes: 1350,
      endMinutes: 1380,
    });
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
        events={[]}
        weekDays={[new Date("2026-07-13T00:00:00")]}
        startHour={6}
        endHour={22}
        hourHeight={72}
      />,
    );

    const timeline = screen.getByTestId("calendar-desktop-timeline");
    expect(timeline).toHaveClass("overflow-y-auto");
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

describe("calendar scroll memory", () => {
  it("restores the vertical timeline position for the same week", () => {
    const props = {
      sessions: [],
      events: [],
      weekDays: [new Date("2026-07-13T00:00:00")],
      startHour: 6,
      endHour: 22,
      hourHeight: 72,
    };
    const firstView = render(<CalendarGrid {...props} />);
    const firstTimeline = screen.getByTestId("calendar-desktop-timeline");

    firstTimeline.scrollTop = 384;
    fireEvent.scroll(firstTimeline);
    firstView.unmount();

    render(<CalendarGrid {...props} />);
    expect(screen.getByTestId("calendar-desktop-timeline").scrollTop).toBe(384);
  });
});
