import type Database from "@tauri-apps/plugin-sql";
import { getDb } from "./schema";
import type { CalendarEvent } from "./types";

export interface CalendarEventInput {
  title: string;
  startsAt: string;
  endsAt: string;
  notes?: string | null;
}

const MAX_TITLE_LENGTH = 120;
const MAX_NOTES_LENGTH = 2000;
let ensureCalendarEventsTablePromise: Promise<void> | null = null;

function ensureCalendarEventsTable(database: Database): Promise<void> {
  ensureCalendarEventsTablePromise ??= (async () => {
    await database.execute(`
      CREATE TABLE IF NOT EXISTS calendar_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        starts_at DATETIME NOT NULL,
        ends_at DATETIME NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        CHECK (ends_at > starts_at)
      )
    `);
    await database.execute(
      "CREATE INDEX IF NOT EXISTS idx_calendar_events_starts_at ON calendar_events(starts_at)",
    );
  })();
  return ensureCalendarEventsTablePromise;
}

function normalizeCalendarEventInput(input: CalendarEventInput): Required<CalendarEventInput> {
  const title = input.title.trim();
  const notes = input.notes?.trim() || null;
  const startsAt = input.startsAt.trim();
  const endsAt = input.endsAt.trim();
  const startsAtMs = new Date(startsAt.replace(" ", "T")).getTime();
  const endsAtMs = new Date(endsAt.replace(" ", "T")).getTime();

  if (!title) throw new Error("请填写这段时间的内容。");
  if (title.length > MAX_TITLE_LENGTH) {
    throw new Error(`内容不能超过 ${MAX_TITLE_LENGTH} 个字符。`);
  }
  if (notes && notes.length > MAX_NOTES_LENGTH) {
    throw new Error(`备注不能超过 ${MAX_NOTES_LENGTH} 个字符。`);
  }
  if (!Number.isFinite(startsAtMs) || !Number.isFinite(endsAtMs)) {
    throw new Error("请选择有效的开始和结束时间。");
  }
  if (endsAtMs <= startsAtMs) throw new Error("结束时间必须晚于开始时间。");
  if (startsAt.slice(0, 10) !== endsAt.slice(0, 10)) {
    throw new Error("当前版本每条时间记录需要在同一天内完成。");
  }

  return { title, startsAt, endsAt, notes };
}

export async function getCalendarEvents(
  weekStart: string,
  weekEnd: string,
): Promise<CalendarEvent[]> {
  const database = await getDb();
  await ensureCalendarEventsTable(database);
  return database.select<CalendarEvent[]>(
    `SELECT id, title, starts_at, ends_at, notes, created_at, updated_at
     FROM calendar_events
     WHERE date(starts_at) >= $1 AND date(starts_at) <= $2
     ORDER BY starts_at ASC, id ASC`,
    [weekStart, weekEnd],
  );
}

export async function addCalendarEvent(input: CalendarEventInput): Promise<number> {
  const normalized = normalizeCalendarEventInput(input);
  const database = await getDb();
  await ensureCalendarEventsTable(database);
  const result = await database.execute(
    `INSERT INTO calendar_events (title, starts_at, ends_at, notes)
     VALUES ($1, $2, $3, $4)`,
    [normalized.title, normalized.startsAt, normalized.endsAt, normalized.notes],
  );
  return result.lastInsertId as number;
}

export async function updateCalendarEvent(
  eventId: number,
  input: CalendarEventInput,
): Promise<void> {
  const normalized = normalizeCalendarEventInput(input);
  const database = await getDb();
  await ensureCalendarEventsTable(database);
  const result = await database.execute(
    `UPDATE calendar_events
     SET title = $2,
         starts_at = $3,
         ends_at = $4,
         notes = $5,
         updated_at = datetime('now', 'localtime')
     WHERE id = $1`,
    [eventId, normalized.title, normalized.startsAt, normalized.endsAt, normalized.notes],
  );
  if (result.rowsAffected !== 1) {
    throw new Error("这条时间记录已不存在，请刷新日历后重试。");
  }
}

export async function deleteCalendarEvent(eventId: number): Promise<void> {
  const database = await getDb();
  await ensureCalendarEventsTable(database);
  const result = await database.execute(
    "DELETE FROM calendar_events WHERE id = $1",
    [eventId],
  );
  if (result.rowsAffected !== 1) {
    throw new Error("这条时间记录已不存在，请刷新日历后重试。");
  }
}
