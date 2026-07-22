import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addCalendarEvent,
  deleteCalendarEvent,
  getCalendarEvents,
  updateCalendarEvent,
} from "@/lib/db/calendar-events";
import { getDb } from "@/lib/db/schema";

vi.mock("@/lib/db/schema", () => ({ getDb: vi.fn() }));

const execute = vi.fn();
const select = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDb).mockResolvedValue({ execute, select } as never);
  execute.mockResolvedValue({ lastInsertId: 8, rowsAffected: 1 });
  select.mockResolvedValue([]);
});

describe("calendar event database boundaries", () => {
  it("stores and reads calendar events independently from focus sessions", async () => {
    const eventId = await addCalendarEvent({
      title: " 产品周会 ",
      startsAt: "2026-07-22 10:00:00",
      endsAt: "2026-07-22 11:00:00",
      notes: " 讨论路线 ",
    });

    expect(eventId).toBe(8);
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO calendar_events"),
      ["产品周会", "2026-07-22 10:00:00", "2026-07-22 11:00:00", "讨论路线"],
    );

    await getCalendarEvents("2026-07-20", "2026-07-26");
    expect(select).toHaveBeenCalledWith(
      expect.stringContaining("FROM calendar_events"),
      ["2026-07-20", "2026-07-26"],
    );
  });

  it("rejects invalid and cross-day ranges before writing", async () => {
    await expect(addCalendarEvent({
      title: "无效会议",
      startsAt: "2026-07-22 11:00:00",
      endsAt: "2026-07-22 10:00:00",
    })).rejects.toThrow("结束时间必须晚于开始时间");

    await expect(addCalendarEvent({
      title: "跨天会议",
      startsAt: "2026-07-22 23:00:00",
      endsAt: "2026-07-23 00:30:00",
    })).rejects.toThrow("同一天");
  });

  it("updates and deletes only the selected calendar event", async () => {
    await updateCalendarEvent(8, {
      title: "更新后的周会",
      startsAt: "2026-07-22 10:00:00",
      endsAt: "2026-07-22 11:30:00",
      notes: null,
    });
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE calendar_events"),
      [8, "更新后的周会", "2026-07-22 10:00:00", "2026-07-22 11:30:00", null],
    );

    await deleteCalendarEvent(8);
    expect(execute).toHaveBeenCalledWith("DELETE FROM calendar_events WHERE id = $1", [8]);
  });
});
