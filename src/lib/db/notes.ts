import { getDb } from "./schema";
import type { Note } from "./types";

const NOTE_ORDER = "ORDER BY title COLLATE NOCASE ASC, created_at DESC";

export async function getNotes(): Promise<Note[]> {
  const database = await getDb();
  return database.select<Note[]>(
    `SELECT id, title, content, created_at, updated_at FROM notes ${NOTE_ORDER}`,
  );
}

export async function addNote(
  title: string,
  content = "",
): Promise<number> {
  const database = await getDb();
  const result = await database.execute(
    "INSERT INTO notes (title, content) VALUES ($1, $2)",
    [title, content],
  );
  return result.lastInsertId as number;
}

export async function updateNote(
  id: number,
  fields: Partial<Pick<Note, "title" | "content">>,
): Promise<void> {
  const database = await getDb();
  const updates: string[] = [];
  const values: (number | string)[] = [];
  let paramIndex = 1;

  if (fields.title !== undefined) {
    updates.push(`title = $${paramIndex++}`);
    values.push(fields.title);
  }
  if (fields.content !== undefined) {
    updates.push(`content = $${paramIndex++}`);
    values.push(fields.content);
  }

  if (updates.length === 0) return;

  values.push(id);
  await database.execute(
    `
    UPDATE notes
    SET ${updates.join(", ")},
        updated_at = datetime('now', 'localtime')
    WHERE id = $${paramIndex}
    `,
    values,
  );
}

export async function deleteNote(id: number): Promise<void> {
  const database = await getDb();
  await database.execute("DELETE FROM notes WHERE id = $1", [id]);
}
