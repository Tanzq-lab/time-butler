import { getDb } from "./schema";

export async function getTasks(): Promise<
  {
    id: number;
    name: string;
    project?: string;
    priority?: "low" | "medium" | "high";
    sort_order: number;
    estimated_pomos: number;
    completed_pomos: number;
    category_id: number | null;
    scheduled_for: string | null;
    completed_at: string | null;
    completion_review: string | null;
    notes: string | null;
    created_at: string;
    archived: number;
  }[]
> {
  const database = await getDb();
  return database.select<
    {
      id: number;
      name: string;
      project?: string;
      priority?: "low" | "medium" | "high";
      sort_order: number;
      estimated_pomos: number;
      completed_pomos: number;
      category_id: number | null;
      scheduled_for: string | null;
      completed_at: string | null;
      completion_review: string | null;
      notes: string | null;
      created_at: string;
      archived: number;
    }[]
  >("SELECT * FROM tasks WHERE archived = 0 ORDER BY sort_order ASC, created_at DESC");
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
      sort_order
    ) VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      COALESCE((SELECT MIN(sort_order) FROM tasks WHERE archived = 0), 0) - 1
    )`,
    [
      name,
      estimatedPomos,
      project ?? null,
      priority ?? null,
      categoryId ?? null,
      scheduledFor ?? null,
    ],
  );
  return result.lastInsertId as number;
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

export async function reorderTasks(orderedIds: number[]): Promise<void> {
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
  const parameters: number[] = [];
  orderedIds.forEach((id, index) => {
    parameters.push(id, index);
  });

  const database = await getDb();
  await database.execute(
    `UPDATE tasks
     SET sort_order = CASE id ${caseClauses} ELSE sort_order END
     WHERE id IN (${idPlaceholders})
       AND archived = 0`,
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
  await database.execute("DELETE FROM sessions WHERE task_id = $1", [id]);
  await database.execute("DELETE FROM tasks WHERE id = $1", [id]);
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
): Promise<void> {
  const database = await getDb();
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
