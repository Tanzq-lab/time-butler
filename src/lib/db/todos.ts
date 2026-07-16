import { getDb } from "./schema";
import type { Todo } from "./types";

export async function getTodos(): Promise<Todo[]> {
  const database = await getDb();
  return database.select<Todo[]>(
    `SELECT id, title, sort_order, completed_at, archived, created_at, updated_at
     FROM todos
     WHERE archived = 0
     ORDER BY
       CASE WHEN completed_at IS NULL THEN 0 ELSE 1 END,
       CASE WHEN completed_at IS NULL THEN sort_order END ASC,
       CASE WHEN completed_at IS NOT NULL THEN completed_at END DESC,
       id DESC`,
  );
}

export async function addTodo(
  title: string,
  createdAt: string,
): Promise<number> {
  const database = await getDb();
  const result = await database.execute(
    `INSERT INTO todos (title, sort_order, created_at, updated_at)
     VALUES (
       $1,
       COALESCE(
         (SELECT MIN(sort_order) FROM todos WHERE archived = 0 AND completed_at IS NULL),
         0
       ) - 1,
       $2,
       $3
     )`,
    [title, createdAt, createdAt],
  );
  return result.lastInsertId as number;
}

export async function reorderTodos(
  orderedIds: number[],
  updatedAt: string,
): Promise<void> {
  if (orderedIds.length === 0) return;

  const caseClauses = orderedIds
    .map((_, index) => `WHEN $${index * 2 + 1} THEN $${index * 2 + 2}`)
    .join(" ");
  const idPlaceholders = orderedIds
    .map((_, index) => `$${index * 2 + 1}`)
    .join(", ");
  const parameters: Array<number | string> = [];
  orderedIds.forEach((id, index) => {
    parameters.push(id, index);
  });
  parameters.push(updatedAt);

  const database = await getDb();
  await database.execute(
    `UPDATE todos
     SET sort_order = CASE id ${caseClauses} ELSE sort_order END,
         updated_at = $${parameters.length}
     WHERE id IN (${idPlaceholders})
       AND archived = 0
       AND completed_at IS NULL`,
    parameters,
  );
}

export async function updateTodoTitle(
  id: number,
  title: string,
  updatedAt: string,
): Promise<void> {
  const database = await getDb();
  await database.execute(
    `UPDATE todos
     SET title = $1, updated_at = $2
     WHERE id = $3`,
    [title, updatedAt, id],
  );
}

export async function setTodoCompleted(
  id: number,
  completedAt: string | null,
  updatedAt: string,
): Promise<void> {
  const database = await getDb();
  await database.execute(
    `UPDATE todos
     SET completed_at = $1, updated_at = $2
     WHERE id = $3`,
    [completedAt, updatedAt, id],
  );
}

export async function archiveTodo(
  id: number,
  updatedAt: string,
): Promise<void> {
  const database = await getDb();
  await database.execute(
    `UPDATE todos
     SET archived = 1, updated_at = $1
     WHERE id = $2`,
    [updatedAt, id],
  );
}
