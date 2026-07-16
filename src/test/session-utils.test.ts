import { describe, it, expect } from "vitest";
import { countCompletedPomos, formatTime, formatDuration, formatTotalTime } from "@/lib/session-utils";
import type { Session } from "@/lib/db";

function makeSession(overrides: Partial<Session>): Session {
  return {
    id: 1,
    task_id: 1,
    phase: "work",
    started_at: "2026-07-16 09:00:00",
    ended_at: "2026-07-16 09:25:00",
    duration_sec: 1500,
    completed: 1,
    pomo_counted: 1,
    category_id: null,
    intention: null,
    mood: null,
    notes: null,
    ...overrides,
  };
}

describe("countCompletedPomos", () => {
  it("counts only completed work sessions that were credited as pomodoros", () => {
    const sessions = [
      makeSession({ id: 1 }),
      makeSession({ id: 2, pomo_counted: 0 }),
      makeSession({ id: 3, completed: 0 }),
      makeSession({ id: 4, phase: "short_break", pomo_counted: 0 }),
    ];

    expect(countCompletedPomos(sessions)).toBe(1);
  });
});

describe("formatDuration", () => {
  it("formats seconds only", () => {
    expect(formatDuration(45)).toBe("45秒");
  });

  it("formats exact minutes", () => {
    expect(formatDuration(120)).toBe("2分钟");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(90)).toBe("1分钟 30秒");
  });

  it("formats zero", () => {
    expect(formatDuration(0)).toBe("0秒");
  });

  it("formats large values", () => {
    expect(formatDuration(3661)).toBe("61分钟 1秒");
  });
});

describe("formatTotalTime", () => {
  it("formats minutes only", () => {
    expect(formatTotalTime(1500)).toBe("25分钟");
  });

  it("formats hours and minutes", () => {
    expect(formatTotalTime(3661)).toBe("1小时 1分钟");
  });

  it("formats exact hours", () => {
    expect(formatTotalTime(7200)).toBe("2小时 0分钟");
  });

  it("formats zero", () => {
    expect(formatTotalTime(0)).toBe("0分钟");
  });

  it("formats under an hour", () => {
    expect(formatTotalTime(1800)).toBe("30分钟");
  });
});

describe("formatTime", () => {
  it("formats a date string", () => {
    const result = formatTime("2026-01-15T14:30:00");
    expect(result).toBe("14:30");
  });
});
