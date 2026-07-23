import { TASK_CATEGORY_NAMES } from "./default-categories";

export type BuiltInRecurringTaskSchedule =
  | "daily"
  | "weekly"
  | "monthly_first_day_off"
  | "yearly_first_day_off";

export interface BuiltInRecurringTaskRuleSeed {
  ruleKey:
    | "summary.weekly"
    | "summary.monthly"
    | "summary.yearly"
    | "anki.daily";
  name: string;
  estimatedPomos: number;
  project: string;
  categoryName: string;
  legacyFrequency: "daily" | "weekly" | "monthly";
  scheduleType: BuiltInRecurringTaskSchedule;
  startDate: string;
  scheduledTime: string;
}

export const BUILT_IN_RECURRING_TASK_RULES:
  readonly BuiltInRecurringTaskRuleSeed[] = [
  {
    ruleKey: "summary.weekly",
    name: "周总结",
    estimatedPomos: 1,
    project: "个人复盘",
    categoryName: TASK_CATEGORY_NAMES.review,
    legacyFrequency: "weekly",
    scheduleType: "weekly",
    startDate: "2026-01-05",
    scheduledTime: "09:00",
  },
  {
    ruleKey: "summary.monthly",
    name: "月总结",
    estimatedPomos: 2,
    project: "个人复盘",
    categoryName: TASK_CATEGORY_NAMES.review,
    legacyFrequency: "monthly",
    scheduleType: "monthly_first_day_off",
    startDate: "2026-01-01",
    scheduledTime: "09:00",
  },
  {
    ruleKey: "summary.yearly",
    name: "年总结",
    estimatedPomos: 4,
    project: "个人复盘",
    categoryName: TASK_CATEGORY_NAMES.review,
    legacyFrequency: "monthly",
    scheduleType: "yearly_first_day_off",
    startDate: "2026-01-01",
    scheduledTime: "09:00",
  },
  {
    ruleKey: "anki.daily",
    name: "复习 ANKI",
    estimatedPomos: 1,
    project: "ANKI",
    categoryName: TASK_CATEGORY_NAMES.memoryReview,
    legacyFrequency: "daily",
    scheduleType: "daily",
    startDate: "2026-01-01",
    scheduledTime: "09:00",
  },
] as const;

interface RecurringRuleDatabase {
  execute: (query: string, bindValues?: unknown[]) => Promise<unknown>;
  select: <T>(query: string, bindValues?: unknown[]) => Promise<T>;
}

export async function seedBuiltInRecurringTaskRules(
  database: RecurringRuleDatabase,
): Promise<void> {
  const categoryRows = await database.select<{ id: number; name: string }[]>(
    "SELECT id, name FROM categories",
  );
  const categoryIds = new Map(
    categoryRows.map((category) => [category.name, category.id]),
  );

  for (const rule of BUILT_IN_RECURRING_TASK_RULES) {
    await database.execute(
      `INSERT OR IGNORE INTO recurring_task_rules (
        rule_key,
        name,
        estimated_pomos,
        project,
        category_id,
        frequency,
        schedule_type,
        start_date,
        scheduled_time
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        rule.ruleKey,
        rule.name,
        rule.estimatedPomos,
        rule.project,
        categoryIds.get(rule.categoryName) ?? null,
        rule.legacyFrequency,
        rule.scheduleType,
        rule.startDate,
        rule.scheduledTime,
      ],
    );
  }
}
