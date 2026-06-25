import { getDb } from "./schema";
import type { TimePage, TimePageType, WeekPlanItem } from "./types";
import {
  getDefaultPageContent,
  getPageTitle,
  getWorkspaceKeys,
} from "@/lib/time-pages";

async function getTimePageByDateKey(dateKey: string): Promise<TimePage | null> {
  const database = await getDb();
  const rows = await database.select<TimePage[]>(
    `SELECT id, type, title, date_key, parent_id, content, created_at, updated_at
     FROM time_pages
     WHERE date_key = $1
     LIMIT 1`,
    [dateKey],
  );
  return rows[0] ?? null;
}

async function createTimePageIfMissing(
  type: TimePageType,
  dateKey: string,
  parentId: number | null,
): Promise<TimePage> {
  const existing = await getTimePageByDateKey(dateKey);
  if (existing) return existing;

  const database = await getDb();
  const title = getPageTitle(type, dateKey);
  const content = getDefaultPageContent(type, title);
  await database.execute(
    `INSERT INTO time_pages (type, title, date_key, parent_id, content)
     VALUES ($1, $2, $3, $4, $5)`,
    [type, title, dateKey, parentId, content],
  );
  const created = await getTimePageByDateKey(dateKey);
  if (!created) {
    throw new Error(`Failed to create time page: ${dateKey}`);
  }
  return created;
}

export async function ensureTimeWorkspace(date = new Date()): Promise<{
  pages: TimePage[];
  overviewPageId: number;
  yearPageId: number;
  monthPageId: number;
  weekPageId: number;
  dayPageId: number;
}> {
  const keys = getWorkspaceKeys(date);
  const overview = await createTimePageIfMissing("overview", keys.overview, null);
  const year = await createTimePageIfMissing("year", keys.year, overview.id);
  const month = await createTimePageIfMissing("month", keys.month, year.id);
  const week = await createTimePageIfMissing("week", keys.week, month.id);
  const day = await createTimePageIfMissing("day", keys.day, week.id);
  const pages = await getTimePages();

  return {
    pages,
    overviewPageId: overview.id,
    yearPageId: year.id,
    monthPageId: month.id,
    weekPageId: week.id,
    dayPageId: day.id,
  };
}

export async function getTimePages(): Promise<TimePage[]> {
  const database = await getDb();
  return database.select<TimePage[]>(
    `SELECT id, type, title, date_key, parent_id, content, created_at, updated_at
     FROM time_pages
     ORDER BY
       CASE type
         WHEN 'overview' THEN 0
         WHEN 'year' THEN 1
         WHEN 'month' THEN 2
         WHEN 'week' THEN 3
         WHEN 'day' THEN 4
         ELSE 5
       END,
       date_key DESC`,
  );
}

export async function updateTimePageContent(
  id: number,
  content: string,
): Promise<void> {
  const database = await getDb();
  await database.execute(
    `UPDATE time_pages
     SET content = $1,
         updated_at = datetime('now', 'localtime')
     WHERE id = $2`,
    [content, id],
  );
}

export async function getWeekPlanItems(
  weekPageId: number,
): Promise<WeekPlanItem[]> {
  const database = await getDb();
  return database.select<WeekPlanItem[]>(
    `SELECT id, week_page_id, title, sort_order, archived, created_at, updated_at
     FROM week_plan_items
     WHERE week_page_id = $1 AND archived = 0
     ORDER BY sort_order ASC, created_at ASC`,
    [weekPageId],
  );
}

export async function addWeekPlanItem(
  weekPageId: number,
  title: string,
): Promise<number> {
  const database = await getDb();
  const rows = await database.select<{ next_order: number }[]>(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
     FROM week_plan_items
     WHERE week_page_id = $1`,
    [weekPageId],
  );
  const result = await database.execute(
    `INSERT INTO week_plan_items (week_page_id, title, sort_order)
     VALUES ($1, $2, $3)`,
    [weekPageId, title, rows[0]?.next_order ?? 0],
  );
  return result.lastInsertId as number;
}

export async function updateWeekPlanItemTitle(
  id: number,
  title: string,
): Promise<void> {
  const database = await getDb();
  await database.execute(
    `UPDATE week_plan_items
     SET title = $1,
         updated_at = datetime('now', 'localtime')
     WHERE id = $2`,
    [title, id],
  );
}

export async function archiveWeekPlanItem(id: number): Promise<void> {
  const database = await getDb();
  await database.execute(
    `UPDATE week_plan_items
     SET archived = 1,
         updated_at = datetime('now', 'localtime')
     WHERE id = $1`,
    [id],
  );
}

export async function addTaskActivityLog(
  taskId: number,
  action: string,
  fromValue?: string | null,
  toValue?: string | null,
): Promise<void> {
  const database = await getDb();
  await database.execute(
    `INSERT INTO task_activity_log (task_id, action, from_value, to_value)
     VALUES ($1, $2, $3, $4)`,
    [taskId, action, fromValue ?? null, toValue ?? null],
  );
}
