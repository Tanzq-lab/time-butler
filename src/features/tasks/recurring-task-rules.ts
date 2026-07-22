import { getDb } from "@/lib/db";

export type RecurringTaskFrequency = "daily" | "weekly" | "monthly";

export interface RecurringTaskRuleInput {
  name: string;
  estimatedPomos: number;
  project: string | null;
  categoryId: number | null;
  frequency: RecurringTaskFrequency;
  startDate: string;
  scheduledTime: string;
}

export interface UserRecurringTaskRule {
  id: number;
  name: string;
  estimated_pomos: number;
  project: string | null;
  category_id: number | null;
  category_name: string | null;
  frequency: RecurringTaskFrequency;
  start_date: string;
  scheduled_time: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function assertRuleInput(input: RecurringTaskRuleInput): void {
  if (!input.name.trim()) throw new Error("任务名称不能为空");
  if (
    !Number.isInteger(input.estimatedPomos)
    || input.estimatedPomos < 1
    || input.estimatedPomos > 4
  ) {
    throw new Error("预计番茄数必须是 1 到 4 的整数");
  }
  if (!DATE_PATTERN.test(input.startDate)) {
    throw new Error("开始日期格式无效");
  }
  if (!TIME_PATTERN.test(input.scheduledTime)) {
    throw new Error("提醒时间格式无效");
  }
  if (!(["daily", "weekly", "monthly"] as const).includes(input.frequency)) {
    throw new Error("循环频率无效");
  }
}

export async function addRecurringTaskRule(
  input: RecurringTaskRuleInput,
): Promise<number> {
  assertRuleInput(input);
  const database = await getDb();
  const result = await database.execute(
    `INSERT INTO recurring_task_rules (
      name,
      estimated_pomos,
      project,
      category_id,
      frequency,
      start_date,
      scheduled_time
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      input.name.trim(),
      input.estimatedPomos,
      input.project?.trim() || null,
      input.categoryId,
      input.frequency,
      input.startDate,
      input.scheduledTime,
    ],
  );
  return result.lastInsertId as number;
}

export async function getEnabledRecurringTaskRules(): Promise<
  UserRecurringTaskRule[]
> {
  return getRecurringTaskRules(true);
}

export async function getRecurringTaskRules(
  enabledOnly = false,
): Promise<UserRecurringTaskRule[]> {
  const database = await getDb();
  return database.select<UserRecurringTaskRule[]>(
    `SELECT
      recurring_task_rules.*,
      categories.name AS category_name
    FROM recurring_task_rules
    LEFT JOIN categories ON categories.id = recurring_task_rules.category_id
    ${enabledOnly ? "WHERE recurring_task_rules.enabled = 1" : ""}
    ORDER BY recurring_task_rules.created_at ASC`,
  );
}

export async function setRecurringTaskRuleEnabled(
  id: number,
  enabled: boolean,
): Promise<void> {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("循环任务规则不存在");
  }
  const database = await getDb();
  await database.execute(
    `UPDATE recurring_task_rules
     SET enabled = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [enabled ? 1 : 0, id],
  );
}
