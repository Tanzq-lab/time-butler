import { getDb } from "./schema";
import type { Todo } from "./types";

export async function getTodos(): Promise<Todo[]> {
  const database = await getDb();
  return database.select<Todo[]>(
    `SELECT id, title, completed_at, archived, created_at, updated_at
     FROM todos
     WHERE archived = 0
     ORDER BY
       CASE WHEN completed_at IS NULL THEN 0 ELSE 1 END,
       CASE WHEN completed_at IS NULL THEN created_at ELSE completed_at END DESC`,
  );
}

export async function addTodo(
  title: string,
  createdAt: string,
): Promise<number> {
  const database = await getDb();
  const result = await database.execute(
    `INSERT INTO todos (title, created_at, updated_at)
     VALUES ($1, $2, $3)`,
    [title, createdAt, createdAt],
  );
  return result.lastInsertId as number;
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
