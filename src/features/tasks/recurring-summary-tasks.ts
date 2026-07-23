import { addTask, getDb } from "@/lib/db";
import { BUILT_IN_RECURRING_TASK_RULES } from "@/lib/db/default-recurring-task-rules";
import { appendPomodoroEstimationLog } from "@/features/tasks/pomodoro-estimation-log";
import {
  getRecurringTaskSchedule,
  getEnabledRecurringTaskRules,
  type UserRecurringTaskRule,
} from "@/features/tasks/recurring-task-rules";

const LOOKAHEAD_DAYS = 7;

export interface RecurringTaskOccurrence {
  ruleKey: string;
  occurrenceDate: string;
  scheduledFor: string;
  name: string;
  estimatedPomos: number;
  project: string;
  categoryName: string;
  categoryId?: number | null;
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

function toScheduledForTime(date: Date, time: string): string {
  return `${toDateKey(date)}T${time}:00`;
}

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function daysBetween(from: Date, to: Date): number {
  const fromUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toUtc - fromUtc) / 86_400_000);
}

function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function userRuleOccursOn(rule: UserRecurringTaskRule, date: Date): boolean {
  const start = parseDateKey(rule.start_date);
  if (toDateKey(date) < rule.start_date) return false;

  const schedule = getRecurringTaskSchedule(rule);
  if (schedule === "daily") return true;
  if (schedule === "weekly") return date.getDay() === start.getDay();
  if (schedule === "monthly_first_day_off") {
    return toDateKey(date) === findFirstDayOffPeriodStartInMonth(
      date.getFullYear(),
      date.getMonth(),
    );
  }
  if (schedule === "yearly_first_day_off") {
    return toDateKey(date) === findFirstDayOffPeriodStartInYear(
      date.getFullYear(),
    );
  }

  const occurrenceDay = Math.min(start.getDate(), daysInMonth(date));
  return date.getDate() === occurrenceDay;
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

export function buildUserRecurringTaskOccurrences(
  rules: UserRecurringTaskRule[],
  referenceDate = new Date(),
  lookaheadDays = LOOKAHEAD_DAYS,
): RecurringTaskOccurrence[] {
  const occurrences: RecurringTaskOccurrence[] = [];
  const start = cloneDate(referenceDate);

  for (const rule of rules) {
    const ruleStart = parseDateKey(rule.start_date);
    const startOffset = daysBetween(start, ruleStart);
    const schedule = getRecurringTaskSchedule(rule);
    const ruleLookahead =
      schedule === "daily"
        ? Math.max(0, Math.min(lookaheadDays, startOffset))
        : lookaheadDays;

    for (let offset = 0; offset <= ruleLookahead; offset += 1) {
      const date = addDays(start, offset);
      if (!userRuleOccursOn(rule, date)) continue;
      occurrences.push({
        ruleKey: rule.rule_key ?? `custom.${rule.id}`,
        occurrenceDate: toDateKey(date),
        scheduledFor: toScheduledForTime(date, rule.scheduled_time),
        name: rule.name,
        estimatedPomos: rule.estimated_pomos,
        project: rule.project?.trim() || "",
        categoryName: rule.category_name?.trim() || "",
        categoryId: rule.category_id,
        reason: `用户配置的${
          schedule === "daily"
            ? "每日"
            : schedule === "weekly"
              ? "每周"
              : schedule === "monthly"
                ? "每月"
                : schedule === "monthly_first_day_off"
                  ? "每月首个休息日"
                  : "每年首个休息日"
        }循环任务，沿用规则中设置的 ${rule.estimated_pomos} 个番茄预估。`,
      });
    }
  }

  return occurrences;
}

export function buildSummaryTaskOccurrences(
  referenceDate = new Date(),
  lookaheadDays = LOOKAHEAD_DAYS,
): RecurringTaskOccurrence[] {
  const builtInRules: UserRecurringTaskRule[] = BUILT_IN_RECURRING_TASK_RULES.map(
    (rule, index) => ({
      id: -(index + 1),
      rule_key: rule.ruleKey,
      name: rule.name,
      estimated_pomos: rule.estimatedPomos,
      project: rule.project,
      category_id: null,
      category_name: rule.categoryName,
      frequency: rule.legacyFrequency,
      schedule_type: rule.scheduleType,
      start_date: rule.startDate,
      scheduled_time: rule.scheduledTime,
      enabled: 1,
      created_at: rule.startDate,
      updated_at: rule.startDate,
    }),
  );

  return buildUserRecurringTaskOccurrences(
    builtInRules,
    referenceDate,
    lookaheadDays,
  );
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
  ruleKey: string,
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
  const userRules = await getEnabledRecurringTaskRules();
  const occurrences = buildUserRecurringTaskOccurrences(userRules, referenceDate);
  if (occurrences.length === 0) return 0;

  const categoryIds = new Map<string, number | null>();
  let createdCount = 0;

  for (const occurrence of occurrences) {
    if (
      occurrence.categoryId === undefined
      && occurrence.categoryName
      && !categoryIds.has(occurrence.categoryName)
    ) {
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
      occurrence.categoryId
        ?? categoryIds.get(occurrence.categoryName)
        ?? null,
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
