import { TASK_CATEGORY_NAMES } from "@/lib/db/default-categories";
import { addTask, getDb } from "@/lib/db";
import { appendPomodoroEstimationLog } from "@/features/tasks/pomodoro-estimation-log";

const LOOKAHEAD_DAYS = 7;
const SUMMARY_TASK_HOUR = 9;
const SUMMARY_PROJECT = "个人复盘";
const SUMMARY_CATEGORY = TASK_CATEGORY_NAMES.review;
const DAILY_ANKI_TASK_HOUR = 9;
const DAILY_ANKI_PROJECT = "ANKI";
const DAILY_ANKI_CATEGORY = TASK_CATEGORY_NAMES.memoryReview;

type RecurringTaskRuleKey =
  | "summary.weekly"
  | "summary.monthly"
  | "summary.yearly"
  | "anki.daily";

interface RecurringTaskRule {
  key: RecurringTaskRuleKey;
  name: string;
  estimatedPomos: number;
  shouldCreateOn: (date: Date) => boolean;
  scheduledHour: number;
  project: string;
  categoryName: string;
  reason: string;
  lookaheadDays?: number;
}

export interface RecurringTaskOccurrence {
  ruleKey: RecurringTaskRuleKey;
  occurrenceDate: string;
  scheduledFor: string;
  name: string;
  estimatedPomos: number;
  project: string;
  categoryName: string;
  reason: string;
}

const KNOWN_CHINA_OFF_DAYS = new Set([
  "2026-01-01",
  "2026-01-02",
  "2026-01-03",
  "2026-02-15",
  "2026-02-16",
  "2026-02-17",
  "2026-02-18",
  "2026-02-19",
  "2026-02-20",
  "2026-02-21",
  "2026-02-22",
  "2026-02-23",
  "2026-04-04",
  "2026-04-05",
  "2026-04-06",
  "2026-05-01",
  "2026-05-02",
  "2026-05-03",
  "2026-05-04",
  "2026-05-05",
  "2026-06-19",
  "2026-06-20",
  "2026-06-21",
  "2026-09-25",
  "2026-09-26",
  "2026-09-27",
  "2026-10-01",
  "2026-10-02",
  "2026-10-03",
  "2026-10-04",
  "2026-10-05",
  "2026-10-06",
  "2026-10-07",
]);

const KNOWN_CHINA_WORK_DAYS = new Set([
  "2026-01-04",
  "2026-02-14",
  "2026-02-28",
  "2026-05-09",
  "2026-09-20",
  "2026-10-10",
]);

function cloneDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function toDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function toScheduledFor(date: Date, hour: number): string {
  return `${toDateKey(date)}T${String(hour).padStart(2, "0")}:00:00`;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isFixedStatutoryOffDay(date: Date): boolean {
  const month = date.getMonth();
  const day = date.getDate();
  return (
    (month === 0 && day === 1) ||
    (month === 4 && day === 1) ||
    (month === 9 && day >= 1 && day <= 3)
  );
}

export function isDayOff(date: Date): boolean {
  const dateKey = toDateKey(date);
  if (KNOWN_CHINA_WORK_DAYS.has(dateKey)) return false;
  if (KNOWN_CHINA_OFF_DAYS.has(dateKey)) return true;
  if (isFixedStatutoryOffDay(date)) return true;
  return isWeekend(date);
}

function isDayOffPeriodStart(date: Date): boolean {
  return isDayOff(date) && !isDayOff(addDays(date, -1));
}

export function findFirstDayOffPeriodStartInMonth(
  year: number,
  monthIndex: number,
): string | null {
  let cursor = new Date(year, monthIndex, 1);
  while (cursor.getFullYear() === year && cursor.getMonth() === monthIndex) {
    if (isDayOffPeriodStart(cursor)) return toDateKey(cursor);
    cursor = addDays(cursor, 1);
  }
  return null;
}

function findFirstDayOffPeriodStartInYear(year: number): string | null {
  let cursor = new Date(year, 0, 1);
  while (cursor.getFullYear() === year) {
    if (isDayOffPeriodStart(cursor)) return toDateKey(cursor);
    cursor = addDays(cursor, 1);
  }
  return null;
}

const RECURRING_TASK_RULES: RecurringTaskRule[] = [
  {
    key: "summary.weekly",
    name: "周总结",
    estimatedPomos: 1,
    shouldCreateOn: (date) => date.getDay() === 1,
    scheduledHour: SUMMARY_TASK_HOUR,
    project: SUMMARY_PROJECT,
    categoryName: SUMMARY_CATEGORY,
    reason: "周总结是明确的周期检查和修改任务，按 1 个番茄预估。",
  },
  {
    key: "summary.monthly",
    name: "月总结",
    estimatedPomos: 2,
    shouldCreateOn: (date) =>
      toDateKey(date) ===
      findFirstDayOffPeriodStartInMonth(date.getFullYear(), date.getMonth()),
    scheduledHour: SUMMARY_TASK_HOUR,
    project: SUMMARY_PROJECT,
    categoryName: SUMMARY_CATEGORY,
    reason: "月总结需要回顾并归纳一个月的记录，按 2 个番茄预估。",
  },
  {
    key: "summary.yearly",
    name: "年总结",
    estimatedPomos: 4,
    shouldCreateOn: (date) =>
      toDateKey(date) === findFirstDayOffPeriodStartInYear(date.getFullYear()),
    scheduledHour: SUMMARY_TASK_HOUR,
    project: SUMMARY_PROJECT,
    categoryName: SUMMARY_CATEGORY,
    reason: "年总结涉及全年复盘和输出，按 4 个番茄预估。",
  },
  {
    key: "anki.daily",
    name: "复习 ANKI",
    estimatedPomos: 1,
    shouldCreateOn: () => true,
    scheduledHour: DAILY_ANKI_TASK_HOUR,
    project: DAILY_ANKI_PROJECT,
    categoryName: DAILY_ANKI_CATEGORY,
    reason: "ANKI 复习是明确的每日记忆巩固任务，按 1 个番茄预估。",
    lookaheadDays: 0,
  },
];

export function buildSummaryTaskOccurrences(
  referenceDate = new Date(),
  lookaheadDays = LOOKAHEAD_DAYS,
): RecurringTaskOccurrence[] {
  const occurrences: RecurringTaskOccurrence[] = [];
  const start = cloneDate(referenceDate);

  for (let offset = 0; offset <= lookaheadDays; offset += 1) {
    const date = addDays(start, offset);
    for (const rule of RECURRING_TASK_RULES) {
      if (offset > (rule.lookaheadDays ?? lookaheadDays)) continue;
      if (!rule.shouldCreateOn(date)) continue;
      occurrences.push({
        ruleKey: rule.key,
        occurrenceDate: toDateKey(date),
        scheduledFor: toScheduledFor(date, rule.scheduledHour),
        name: rule.name,
        estimatedPomos: rule.estimatedPomos,
        project: rule.project,
        categoryName: rule.categoryName,
        reason: rule.reason,
      });
    }
  }

  return occurrences;
}

async function getCategoryIdByName(categoryName: string): Promise<number | null> {
  const database = await getDb();
  const rows = await database.select<{ id: number }[]>(
    "SELECT id FROM categories WHERE name = $1 LIMIT 1",
    [categoryName],
  );
  return rows[0]?.id ?? null;
}

async function getExistingOccurrence(
  ruleKey: RecurringTaskRuleKey,
  occurrenceDate: string,
): Promise<number | null> {
  const database = await getDb();
  const rows = await database.select<{ task_id: number }[]>(
    "SELECT task_id FROM recurring_task_occurrences WHERE rule_key = $1 AND occurrence_date = $2 LIMIT 1",
    [ruleKey, occurrenceDate],
  );
  return rows[0]?.task_id ?? null;
}

async function findExistingTaskId(
  name: string,
  scheduledFor: string,
): Promise<number | null> {
  const database = await getDb();
  const rows = await database.select<{ id: number }[]>(
    "SELECT id FROM tasks WHERE archived = 0 AND name = $1 AND scheduled_for = $2 LIMIT 1",
    [name, scheduledFor],
  );
  return rows[0]?.id ?? null;
}

async function recordOccurrence(
  occurrence: RecurringTaskOccurrence,
  taskId: number,
): Promise<void> {
  const database = await getDb();
  await database.execute(
    "INSERT OR IGNORE INTO recurring_task_occurrences (rule_key, occurrence_date, task_id) VALUES ($1, $2, $3)",
    [occurrence.ruleKey, occurrence.occurrenceDate, taskId],
  );
}

async function logCreatedOccurrence(
  occurrence: RecurringTaskOccurrence,
): Promise<void> {
  await appendPomodoroEstimationLog({
    event: "created",
    createdAt: new Date().toISOString(),
    taskName: occurrence.name,
    project: occurrence.project,
    category: occurrence.categoryName,
    estimatedPomos: occurrence.estimatedPomos,
    confidence: "high",
    reason: occurrence.reason,
    needsBreakdown: false,
  });
}

const inFlightRecurringTaskGenerations = new Map<string, Promise<number>>();

async function createMissingRecurringSummaryTasks(
  referenceDate = new Date(),
): Promise<number> {
  const occurrences = buildSummaryTaskOccurrences(referenceDate);
  if (occurrences.length === 0) return 0;

  const categoryIds = new Map<string, number | null>();
  let createdCount = 0;

  for (const occurrence of occurrences) {
    if (!categoryIds.has(occurrence.categoryName)) {
      categoryIds.set(
        occurrence.categoryName,
        await getCategoryIdByName(occurrence.categoryName),
      );
    }

    const existingOccurrence = await getExistingOccurrence(
      occurrence.ruleKey,
      occurrence.occurrenceDate,
    );
    if (existingOccurrence) continue;

    const existingTask = await findExistingTaskId(
      occurrence.name,
      occurrence.scheduledFor,
    );
    if (existingTask) {
      await recordOccurrence(occurrence, existingTask);
      continue;
    }

    const taskId = await addTask(
      occurrence.name,
      occurrence.estimatedPomos,
      occurrence.project,
      "medium",
      categoryIds.get(occurrence.categoryName) ?? null,
      occurrence.scheduledFor,
    );
    await recordOccurrence(occurrence, taskId);
    await logCreatedOccurrence(occurrence);
    createdCount += 1;
  }

  return createdCount;
}

/**
 * Shares same-day generation work across overlapping task refreshes. A window
 * can emit both focus and visibility events as it returns to the foreground;
 * without this guard, each refresh can pass the existence checks before either
 * one records its occurrence.
 */
export function ensureRecurringSummaryTasks(
  referenceDate = new Date(),
): Promise<number> {
  const occurrenceDate = toDateKey(referenceDate);
  const inFlight = inFlightRecurringTaskGenerations.get(occurrenceDate);
  if (inFlight) return inFlight;

  let generation: Promise<number>;
  generation = createMissingRecurringSummaryTasks(referenceDate).finally(() => {
    if (inFlightRecurringTaskGenerations.get(occurrenceDate) === generation) {
      inFlightRecurringTaskGenerations.delete(occurrenceDate);
    }
  });
  inFlightRecurringTaskGenerations.set(occurrenceDate, generation);
  return generation;
}
