import { getDb } from "@/lib/db";
import type { TaskItemType } from "@/features/tasks/task-types";

export type RecurringTaskFrequency =
  | "daily"
  | "weekly"
  | "monthly"
  | "monthly_first_day_off"
  | "yearly_first_day_off";

type LegacyRecurringTaskFrequency = "daily" | "weekly" | "monthly";

export interface RecurringTaskTemplateSubtask {
  name: string;
  itemType: TaskItemType;
  estimatedPomos: number;
}

export interface RecurringTaskRuleInput {
  name: string;
  itemType: TaskItemType;
  estimatedPomos: number;
  project: string | null;
  categoryId: number | null;
  frequency: RecurringTaskFrequency;
  startDate: string;
  scheduledTime: string;
  subtasks?: RecurringTaskTemplateSubtask[];
}

export interface UserRecurringTaskRule {
  id: number;
  name: string;
  item_type?: TaskItemType | null;
  estimated_pomos: number;
  project: string | null;
  category_id: number | null;
  category_name: string | null;
  frequency: LegacyRecurringTaskFrequency;
  schedule_type?: RecurringTaskFrequency | null;
  rule_key?: string | null;
  start_date: string;
  scheduled_time: string;
  subtasks_json?: string | null;
  enabled: number;
  created_at: string;
  updated_at: string;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const SCHEDULE_TYPES: readonly RecurringTaskFrequency[] = [
  "daily",
  "weekly",
  "monthly",
  "monthly_first_day_off",
  "yearly_first_day_off",
];

function toLegacyFrequency(
  frequency: RecurringTaskFrequency,
): LegacyRecurringTaskFrequency {
  return frequency === "monthly_first_day_off" || frequency === "yearly_first_day_off"
    ? "monthly"
    : frequency;
}

export function getRecurringTaskSchedule(
  rule: UserRecurringTaskRule,
): RecurringTaskFrequency {
  return rule.schedule_type ?? rule.frequency;
}

export function getRecurringTaskItemType(
  rule: UserRecurringTaskRule,
): TaskItemType {
  return rule.item_type === "todo" ? "todo" : "focus";
}

function normalizeRecurringTaskSubtasks(
  subtasks: RecurringTaskTemplateSubtask[] = [],
): RecurringTaskTemplateSubtask[] {
  return subtasks.map((subtask) => {
    const name = subtask.name.trim();
    if (!name) throw new Error("子任务名称不能为空");
    if (subtask.itemType !== "todo" && subtask.itemType !== "focus") {
      throw new Error("子任务类型无效");
    }
    if (
      subtask.itemType === "focus"
      && (
        !Number.isInteger(subtask.estimatedPomos)
        || subtask.estimatedPomos < 1
        || subtask.estimatedPomos > 4
      )
    ) {
      throw new Error("子任务预计番茄数必须是 1 到 4 的整数");
    }
    return {
      name,
      itemType: subtask.itemType,
      estimatedPomos: subtask.itemType === "focus"
        ? subtask.estimatedPomos
        : 1,
    };
  });
}

function serializeRecurringTaskSubtasks(
  subtasks: RecurringTaskTemplateSubtask[] = [],
): string {
  return JSON.stringify(normalizeRecurringTaskSubtasks(subtasks));
}

export function getRecurringTaskSubtasks(
  rule: Pick<UserRecurringTaskRule, "subtasks_json">,
): RecurringTaskTemplateSubtask[] {
  if (!rule.subtasks_json) return [];
  try {
    const parsed = JSON.parse(rule.subtasks_json);
    if (!Array.isArray(parsed)) return [];
    return normalizeRecurringTaskSubtasks(
      parsed as RecurringTaskTemplateSubtask[],
    );
  } catch {
    return [];
  }
}

export function isCustomRecurringTaskRule(
  rule: Pick<UserRecurringTaskRule, "rule_key">,
): boolean {
  return rule.rule_key?.startsWith("custom.") === true;
}

function assertRuleInput(input: RecurringTaskRuleInput): void {
  if (!input.name.trim()) throw new Error("任务名称不能为空");
  if (input.itemType !== "todo" && input.itemType !== "focus") {
    throw new Error("任务类型无效");
  }
  if (
    input.itemType === "focus"
    && (
      !Number.isInteger(input.estimatedPomos)
      || input.estimatedPomos < 1
      || input.estimatedPomos > 4
    )
  ) {
    throw new Error("预计番茄数必须是 1 到 4 的整数");
  }
  if (!DATE_PATTERN.test(input.startDate)) {
    throw new Error("开始日期格式无效");
  }
  if (!TIME_PATTERN.test(input.scheduledTime)) {
    throw new Error("提醒时间格式无效");
  }
  if (!SCHEDULE_TYPES.includes(input.frequency)) {
    throw new Error("循环频率无效");
  }
  normalizeRecurringTaskSubtasks(input.subtasks);
}

export async function addRecurringTaskRule(
  input: RecurringTaskRuleInput,
): Promise<number> {
  assertRuleInput(input);
  const database = await getDb();
  const result = await database.execute(
    `INSERT INTO recurring_task_rules (
      name,
      item_type,
      estimated_pomos,
      project,
      category_id,
      frequency,
      schedule_type,
      start_date,
      scheduled_time,
      subtasks_json
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      input.name.trim(),
      input.itemType,
      input.estimatedPomos,
      input.project?.trim() || null,
      input.categoryId,
      toLegacyFrequency(input.frequency),
      input.frequency,
      input.startDate,
      input.scheduledTime,
      serializeRecurringTaskSubtasks(input.subtasks),
    ],
  );
  const ruleId = result.lastInsertId as number;
  await database.execute(
    "UPDATE recurring_task_rules SET rule_key = $1 WHERE id = $2",
    [`custom.${ruleId}`, ruleId],
  );
  return ruleId;
}

export async function updateRecurringTaskRule(
  id: number,
  input: RecurringTaskRuleInput,
): Promise<void> {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("循环任务规则不存在");
  }
  assertRuleInput(input);

  const database = await getDb();
  const result = await database.execute(
    `UPDATE recurring_task_rules
     SET name = $1,
         item_type = $2,
         estimated_pomos = $3,
         project = $4,
         category_id = $5,
         frequency = $6,
         schedule_type = $7,
         start_date = $8,
         scheduled_time = $9,
         subtasks_json = $10,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $11`,
    [
      input.name.trim(),
      input.itemType,
      input.estimatedPomos,
      input.project?.trim() || null,
      input.categoryId,
      toLegacyFrequency(input.frequency),
      input.frequency,
      input.startDate,
      input.scheduledTime,
      serializeRecurringTaskSubtasks(input.subtasks),
      id,
    ],
  );

  if (result.rowsAffected === 0) {
    throw new Error("循环任务规则不存在");
  }
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
    ORDER BY
      CASE WHEN recurring_task_rules.rule_key LIKE 'custom.%' THEN 1 ELSE 0 END,
      recurring_task_rules.created_at ASC,
      recurring_task_rules.id ASC`,
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

export async function deleteRecurringTaskRule(id: number): Promise<void> {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("循环任务规则不存在");
  }

  const database = await getDb();
  const rows = await database.select<{ rule_key: string | null }[]>(
    "SELECT rule_key FROM recurring_task_rules WHERE id = $1 LIMIT 1",
    [id],
  );
  const rule = rows[0];
  if (!rule) {
    throw new Error("循环任务规则不存在");
  }
  if (!isCustomRecurringTaskRule(rule)) {
    throw new Error("内置循环任务不能删除");
  }

  const result = await database.execute(
    "DELETE FROM recurring_task_rules WHERE id = $1 AND rule_key = $2",
    [id, rule.rule_key],
  );
  if (result.rowsAffected === 0) {
    throw new Error("循环任务规则不存在");
  }
}
