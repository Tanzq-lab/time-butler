import { getDb } from "./schema";
import type {
  Task,
  TaskCompletionReview,
  TaskItemType,
} from "@/features/tasks/task-types";

export async function getTasks(): Promise<Task[]> {
  const database = await getDb();
  return database.select<Task[]>(
    `SELECT task.*
     FROM tasks AS task
     WHERE task.archived = 0
       AND NOT EXISTS (
         SELECT 1
         FROM recurring_task_occurrences AS occurrence
         WHERE occurrence.task_id = task.id
           AND occurrence.occurrence_date > date('now', 'localtime')
           AND task.completed_pomos = 0
           AND task.completed_at IS NULL
           AND NOT EXISTS (
             SELECT 1
             FROM sessions AS session
             WHERE session.task_id = task.id
           )
           AND NOT EXISTS (
             SELECT 1
             FROM tasks AS child
             WHERE child.parent_id = task.id
               AND child.archived = 0
           )
       )
     ORDER BY
       CASE WHEN task.parent_id IS NULL THEN 0 ELSE 1 END,
       task.sort_order ASC,
       task.created_at DESC`,
  );
}

export async function getTaskCompletionReviews(
  taskId: number,
): Promise<TaskCompletionReview[]> {
  const database = await getDb();
  return database.select<TaskCompletionReview[]>(
    `SELECT
       id,
       task_id,
       estimated_pomos,
       actual_pomos,
       review,
       completed_at
     FROM task_completion_reviews
     WHERE task_id = $1
     ORDER BY completed_at DESC, id DESC`,
    [taskId],
  );
}

function assertEstimatedPomos(estimatedPomos: number): void {
  if (!Number.isInteger(estimatedPomos) || estimatedPomos < 1 || estimatedPomos > 4) {
    throw new Error("预计番茄数必须是 1 到 4 的整数");
  }
}

export async function addTask(
  name: string,
  estimatedPomos: number,
  project?: string,
  priority?: string,
  categoryId?: number | null,
  scheduledFor?: string | null,
  parentId?: number | null,
): Promise<number> {
  assertEstimatedPomos(estimatedPomos);
  const database = await getDb();
  const result = await database.execute(
    `INSERT INTO tasks (
      name,
      estimated_pomos,
      project,
      priority,
      category_id,
      scheduled_for,
      item_type,
      parent_id,
      sort_order
    ) VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      'focus',
      $7,
      COALESCE((
        SELECT MIN(sort_order)
        FROM tasks
        WHERE archived = 0
          AND parent_id IS $7
      ), 0) - 1
    )`,
    [
      name,
      estimatedPomos,
      project ?? null,
      priority ?? null,
      categoryId ?? null,
      scheduledFor ?? null,
      parentId ?? null,
    ],
  );
  if (parentId != null) {
    await database.execute(
      "UPDATE tasks SET completed_at = NULL WHERE id = $1",
      [parentId],
    );
  }
  return result.lastInsertId as number;
}

export async function addTodoTask(
  name: string,
  parentId?: number | null,
  options: {
    project?: string | null;
    categoryId?: number | null;
    scheduledFor?: string | null;
  } = {},
): Promise<number> {
  const cleanName = name.trim();
  if (!cleanName) throw new Error("待办名称不能为空");

  const database = await getDb();
  const result = await database.execute(
    `INSERT INTO tasks (
      name,
      estimated_pomos,
      completed_pomos,
      item_type,
      parent_id,
      project,
      category_id,
      scheduled_for,
      sort_order
    ) VALUES (
      $1,
      1,
      0,
      'todo',
      $2,
      $3,
      $4,
      $5,
      COALESCE((
        SELECT MAX(sort_order)
        FROM tasks
        WHERE archived = 0
          AND parent_id IS $2
      ), -1) + 1
    )`,
    [
      cleanName,
      parentId ?? null,
      options.project?.trim() || null,
      options.categoryId ?? null,
      options.scheduledFor ?? null,
    ],
  );
  if (parentId != null) {
    await database.execute(
      "UPDATE tasks SET completed_at = NULL WHERE id = $1",
      [parentId],
    );
  }
  return result.lastInsertId as number;
}

export async function setTaskItemType(
  id: number,
  itemType: TaskItemType,
  estimatedPomos?: number,
): Promise<void> {
  if (itemType === "focus") {
    assertEstimatedPomos(estimatedPomos ?? 1);
  }

  const database = await getDb();
  if (itemType === "focus") {
    await database.execute(
      `UPDATE tasks
       SET item_type = 'focus',
           estimated_pomos = $2
       WHERE id = $1`,
      [id, estimatedPomos ?? 1],
    );
    return;
  }

  const result = await database.execute(
    `UPDATE tasks
     SET item_type = 'todo'
     WHERE id = $1
       AND completed_pomos = 0`,
    [id],
  );
  if (result.rowsAffected !== 1) {
    throw new Error("已产生番茄记录的专注任务不能转为待办");
  }
}

async function reconcileParentCompletion(
  parentId: number | null | undefined,
): Promise<number | null> {
  if (parentId == null) return null;

  const database = await getDb();
  const children = await database.select<
    { id: number; completed_at: string | null }[]
  >(
    `SELECT id, completed_at
     FROM tasks
     WHERE parent_id = $1
       AND archived = 0`,
    [parentId],
  );
  const allChildrenDone =
    children.length > 0 && children.every((child) => Boolean(child.completed_at));

  await database.execute(
    `UPDATE tasks
     SET completed_at = CASE
       WHEN $2 = 1 THEN COALESCE(completed_at, datetime('now', 'localtime'))
       ELSE NULL
     END
     WHERE id = $1`,
    [parentId, allChildrenDone ? 1 : 0],
  );
  return parentId;
}

async function getTaskParentId(id: number): Promise<number | null> {
  const database = await getDb();
  const rows = await database.select<{ parent_id: number | null }[]>(
    "SELECT parent_id FROM tasks WHERE id = $1",
    [id],
  );
  return rows[0]?.parent_id ?? null;
}

export async function setTaskCompleted(
  id: number,
  completed: boolean,
): Promise<number | null> {
  const database = await getDb();
  const parentId = await getTaskParentId(id);
  await database.execute(
    `UPDATE tasks
     SET completed_at = CASE
       WHEN $2 = 1 THEN COALESCE(completed_at, datetime('now', 'localtime'))
       ELSE NULL
     END
     WHERE id = $1`,
    [id, completed ? 1 : 0],
  );
  return reconcileParentCompletion(parentId);
}

export async function toggleTaskArchived(
  id: number,
  archived: boolean,
): Promise<void> {
  const database = await getDb();
  await database.execute("UPDATE tasks SET archived = $1 WHERE id = $2", [
    archived ? 1 : 0,
    id,
  ]);
}

export async function reorderTasks(
  orderedIds: number[],
  parentId: number | null = null,
): Promise<void> {
  if (orderedIds.length === 0) return;
  if (
    orderedIds.some((id) => !Number.isInteger(id) || id <= 0)
    || new Set(orderedIds).size !== orderedIds.length
  ) {
    throw new Error("任务排序参数无效");
  }

  const caseClauses = orderedIds
    .map((_, index) => `WHEN $${index * 2 + 1} THEN $${index * 2 + 2}`)
    .join(" ");
  const idPlaceholders = orderedIds
    .map((_, index) => `$${index * 2 + 1}`)
    .join(", ");
  const parameters: Array<number | null> = [];
  orderedIds.forEach((id, index) => {
    parameters.push(id, index);
  });
  parameters.push(parentId);

  const database = await getDb();
  await database.execute(
    `UPDATE tasks
     SET sort_order = CASE id ${caseClauses} ELSE sort_order END
     WHERE id IN (${idPlaceholders})
       AND archived = 0
       AND parent_id IS $${parameters.length}`,
    parameters,
  );
}

export async function updateTask(
  id: number,
  name?: string,
  estimatedPomos?: number,
  project?: string | null,
  priority?: string | null,
  categoryId?: number | null,
  scheduledFor?: string | null,
): Promise<void> {
  if (estimatedPomos !== undefined) assertEstimatedPomos(estimatedPomos);
  const database = await getDb();
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  let paramIndex = 1;

  if (name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(name);
  }
  if (estimatedPomos !== undefined) {
    fields.push(`estimated_pomos = $${paramIndex++}`);
    values.push(estimatedPomos);
  }
  if (project !== undefined) {
    fields.push(`project = $${paramIndex++}`);
    values.push(project ?? null);
  }
  if (priority !== undefined) {
    fields.push(`priority = $${paramIndex++}`);
    values.push(priority ?? null);
  }
  if (categoryId !== undefined) {
    fields.push(`category_id = $${paramIndex++}`);
    values.push(categoryId ?? null);
  }
  if (scheduledFor !== undefined) {
    fields.push(`scheduled_for = $${paramIndex++}`);
    values.push(scheduledFor ?? null);
  }

  if (fields.length === 0) return;
  values.push(id);
  await database.execute(
    `UPDATE tasks SET ${fields.join(", ")} WHERE id = $${paramIndex}`,
    values,
  );
}

export async function deleteTask(id: number): Promise<void> {
  const database = await getDb();
  const parentId = await getTaskParentId(id);
  const children = await database.select<{ id: number }[]>(
    "SELECT id FROM tasks WHERE parent_id = $1",
    [id],
  );
  const deletedTaskIds = [...children.map((child) => child.id), id];

  for (const deletedTaskId of deletedTaskIds) {
    const recurringOccurrences = await database.select<
      { rule_key: string; occurrence_date: string }[]
    >(
      `SELECT rule_key, occurrence_date
       FROM recurring_task_occurrences
       WHERE task_id = $1`,
      [deletedTaskId],
    );
    for (const occurrence of recurringOccurrences) {
      await database.execute(
        `INSERT OR IGNORE INTO recurring_task_occurrence_exclusions (
          rule_key,
          occurrence_date
        ) VALUES ($1, $2)`,
        [occurrence.rule_key, occurrence.occurrence_date],
      );
    }
    await database.execute(
      "DELETE FROM recurring_task_occurrences WHERE task_id = $1",
      [deletedTaskId],
    );
    await database.execute(
      "DELETE FROM task_completion_reviews WHERE task_id = $1",
      [deletedTaskId],
    );
    await database.execute(
      "DELETE FROM sessions WHERE task_id = $1",
      [deletedTaskId],
    );
    await database.execute(
      "DELETE FROM task_activity_log WHERE task_id = $1",
      [deletedTaskId],
    );
  }

  await database.execute("DELETE FROM tasks WHERE parent_id = $1", [id]);
  await database.execute("DELETE FROM tasks WHERE id = $1", [id]);
  await reconcileParentCompletion(parentId);
}

export async function incrementTaskPomos(id: number): Promise<void> {
  const database = await getDb();
  await database.execute(
    "UPDATE tasks SET completed_pomos = completed_pomos + 1 WHERE id = $1",
    [id],
  );
}

export async function completeTask(
  id: number,
  actualPomos: number,
  review?: string | null,
): Promise<number | null> {
  const database = await getDb();
  const parentId = await getTaskParentId(id);
  await database.execute(
    `
    UPDATE tasks
    SET completed_pomos = $2,
        completed_at = datetime('now', 'localtime'),
        completion_review = $3
    WHERE id = $1
    `,
    [id, Math.max(0, actualPomos), review?.trim() || null],
  );
  return reconcileParentCompletion(parentId);
}

function formatTaskNoteTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Appends a timestamped entry without reading and rewriting the whole note in
 * application state, so concurrent record actions cannot overwrite each other.
 */
export async function appendTaskNote(
  id: number,
  content: string,
  recordedAt = new Date(),
): Promise<string> {
  const trimmedContent = content.trim();
  if (!trimmedContent) {
    throw new Error("记录内容不能为空");
  }

  const entry = `**${formatTaskNoteTimestamp(recordedAt)}**\n\n${trimmedContent}`;
  const database = await getDb();

  await database.execute(
    `UPDATE tasks
     SET notes = CASE
       WHEN notes IS NULL OR trim(notes) = '' THEN $2
       ELSE notes || char(10) || char(10) || $2
     END
     WHERE id = $1`,
    [id, entry],
  );

  const rows = await database.select<{ notes: string | null }[]>(
    "SELECT notes FROM tasks WHERE id = $1",
    [id],
  );
  const notes = rows[0]?.notes;
  if (notes == null) {
    throw new Error("任务不存在，无法保存记录");
  }

  return notes;
}

export async function getTaskTimeToday(taskId: number): Promise<number> {
  const database = await getDb();
  const rows = await database.select<{ total: number }[]>(
    "SELECT COALESCE(SUM(duration_sec), 0) AS total FROM sessions WHERE task_id = $1 AND date(started_at) = date('now', 'localtime') AND completed = 1",
    [taskId],
  );
  return rows[0]?.total ?? 0;
}
