import { invoke, isTauri } from "@/lib/tauri";
import { getDb, getDbName } from "./schema";
import type { Session, WeekSession, WeekSummary } from "./types";

export interface CompletedPomoReassignment {
  sourceTaskId: number | null;
  sourceCategoryId: number | null;
  targetTaskId: number;
  targetCategoryId: number | null;
}

export async function addSession(
  taskId: number | null,
  phase: string,
  durationSec: number,
  completed: boolean,
): Promise<number> {
  const database = await getDb();
  const result = await database.execute(
    "INSERT INTO sessions (task_id, phase, duration_sec, completed, ended_at) VALUES ($1, $2, MAX(0, $3), $4, datetime('now', 'localtime'))",
    [taskId, phase, durationSec, completed ? 1 : 0],
  );
  return result.lastInsertId as number;
}

export async function startSession(
  taskId: number | null,
  phase: string,
  categoryId?: number | null,
  intention?: string | null,
): Promise<number> {
  const database = await getDb();
  const result = await database.execute(
    "INSERT INTO sessions (task_id, phase, started_at, duration_sec, completed, category_id, intention) VALUES ($1, $2, datetime('now', 'localtime'), 0, 0, $3, $4) RETURNING id",
    [taskId, phase, categoryId ?? null, intention ?? null],
  );
  return result.lastInsertId as number;
}

export async function finishSession(
  sessionId: number,
  durationSec?: number,
  mood?: string,
  notes?: string,
  completed = true,
): Promise<void> {
  const database = await getDb();

  if (durationSec !== undefined) {
    await database.execute(
      `
      UPDATE sessions
      SET ended_at = datetime('now', 'localtime'),
          duration_sec = $2,
          completed = $3,
          mood = $4,
          notes = $5
      WHERE id = $1
    `,
      [sessionId, durationSec, completed ? 1 : 0, mood ?? null, notes ?? null],
    );
  } else {
    await database.execute(
      `
      UPDATE sessions
      SET ended_at = datetime('now', 'localtime'),
          duration_sec = MAX(0, CAST(strftime('%s', 'now', 'localtime') - strftime('%s', started_at) AS INTEGER)),
          completed = $2,
          mood = $3,
          notes = $4
      WHERE id = $1
    `,
      [sessionId, completed ? 1 : 0, mood ?? null, notes ?? null],
    );
  }
}

export async function creditSessionPomo(sessionId: number): Promise<boolean> {
  const database = await getDb();
  const result = await database.execute(
    `
    UPDATE sessions
    SET pomo_counted = 1
    WHERE id = $1
      AND phase = 'work'
      AND completed = 1
      AND task_id IS NOT NULL
      AND pomo_counted = 0
    `,
    [sessionId],
  );
  return result.rowsAffected === 1;
}

export async function updateSessionAttribution(
  sessionId: number,
  taskId: number | null,
  categoryId?: number | null,
  intention?: string | null,
): Promise<void> {
  const database = await getDb();
  await database.execute(
    `
    UPDATE sessions
    SET task_id = $2,
        category_id = $3,
        intention = $4
    WHERE id = $1 AND completed = 0
    `,
    [sessionId, taskId, categoryId ?? null, intention ?? null],
  );
}

/**
 * Assigns one completed focus session to a visible task.
 *
 * The session remains the source of truth for the time line. Task counters and
 * session category move together so task progress, calendar color, and category
 * analytics do not drift apart. A standalone focus is credited when assigned
 * and has no source task to decrement.
 */
export async function reassignCompletedPomo(
  sessionId: number,
  targetTaskId: number,
): Promise<CompletedPomoReassignment> {
  if (isTauri()) {
    try {
      return await invoke<CompletedPomoReassignment>("reassign_completed_pomo", {
        db: await getDbName(),
        sessionId,
        targetTaskId,
      });
    } catch (error) {
      if (typeof error === "string" && error.trim()) {
        throw new Error(error);
      }
      throw error;
    }
  }

  // Browser tests use the SQL mock below. The real Tauri app always takes the
  // native transaction path above so pooled calls cannot split the transaction.
  const database = await getDb();
  const rows = await database.select<
    {
      source_task_id: number | null;
      source_category_id: number | null;
      source_pomo_counted: number;
      target_category_id: number | null;
    }[]
  >(
    `
      SELECT
        s.task_id AS source_task_id,
        s.category_id AS source_category_id,
        s.pomo_counted AS source_pomo_counted,
        target.category_id AS target_category_id
      FROM sessions s
      JOIN tasks target ON target.id = $2 AND target.archived = 0
      WHERE s.id = $1
        AND s.phase = 'work'
        AND s.completed = 1
        AND (s.task_id IS NULL OR s.pomo_counted = 1)
      `,
    [sessionId, targetTaskId],
  );

  const record = rows[0];
  if (!record) {
    throw new Error("只能更正已完成的独立专注，或已计入统计的任务番茄。");
  }
  if (record.source_task_id === targetTaskId) {
    throw new Error("该番茄已经属于这个任务。");
  }

  const update = await database.execute(
    `
      UPDATE sessions
      SET task_id = $2,
          category_id = $3,
          pomo_counted = 1
      WHERE id = $1
        AND phase = 'work'
        AND completed = 1
        AND task_id IS $4
        AND pomo_counted = $5
      `,
    [
      sessionId,
      targetTaskId,
      record.target_category_id,
      record.source_task_id,
      record.source_pomo_counted,
    ],
  );
  if (update.rowsAffected !== 1) {
    throw new Error("该番茄已被更新，请刷新日历后重试。");
  }

  if (record.source_task_id !== null) {
    await database.execute(
      "UPDATE tasks SET completed_pomos = MAX(0, completed_pomos - 1) WHERE id = $1",
      [record.source_task_id],
    );
    await database.execute(
      "UPDATE tasks SET completed_pomos = completed_pomos + 1 WHERE id = $1",
      [targetTaskId],
    );
  }
  if (record.source_task_id !== null) {
    await database.execute(
      `
        INSERT INTO task_activity_log (task_id, action, from_value, to_value)
        VALUES
          ($1, 'completed_pomo_reassigned_out', $2, $3),
          ($4, 'completed_pomo_reassigned_in', $2, $1)
        `,
      [record.source_task_id, String(sessionId), String(targetTaskId), targetTaskId],
    );
  } else {
    await database.execute(
      `
        INSERT INTO task_activity_log (task_id, action, from_value)
        VALUES ($1, 'completed_pomo_assigned_from_standalone', $2)
        `,
      [targetTaskId, String(sessionId)],
    );
  }

  return {
    sourceTaskId: record.source_task_id,
    sourceCategoryId: record.source_category_id,
    targetTaskId,
    targetCategoryId: record.target_category_id,
  };
}

export async function updateSessionReflection(
  sessionId: number,
  mood?: string,
  notes?: string,
): Promise<void> {
  const database = await getDb();
  await database.execute(
    `
    UPDATE sessions
    SET mood = $2,
        notes = $3
    WHERE id = $1 AND phase = 'work' AND completed = 1
    `,
    [sessionId, mood ?? null, notes ?? null],
  );
}

export async function abandonSession(sessionId: number): Promise<void> {
  const database = await getDb();
  await database.execute(
    "DELETE FROM sessions WHERE id = $1 AND completed = 0",
    [sessionId],
  );
}

export async function getSessions(): Promise<Session[]> {
  const database = await getDb();
  return database.select<Session[]>(
    "SELECT * FROM sessions ORDER BY started_at DESC",
  );
}

export async function getTodaySessions(): Promise<Session[]> {
  const database = await getDb();
  return database.select<Session[]>(
    `
    SELECT
      s.*,
      t.name AS task_name,
      c.name AS category_name,
      c.color AS category_color
    FROM sessions s
    LEFT JOIN tasks t ON s.task_id = t.id
    LEFT JOIN categories c ON s.category_id = c.id
    WHERE date(s.started_at) = date('now', 'localtime') AND s.completed = 1
    ORDER BY s.started_at DESC
  `,
  );
}

export async function getWeekSessions(
  weekStart: string,
  weekEnd: string,
): Promise<WeekSession[]> {
  const database = await getDb();
  return database.select<WeekSession[]>(
    `
    SELECT
      s.id,
      s.task_id,
      t.name AS task_name,
      s.phase,
      s.started_at,
      s.duration_sec,
      s.completed,
      s.pomo_counted,
      s.category_id,
      c.name AS category_name,
      c.color AS category_color,
      s.intention,
      s.mood,
      s.notes
    FROM sessions s
    LEFT JOIN tasks t ON s.task_id = t.id
    LEFT JOIN categories c ON s.category_id = c.id
    WHERE date(s.started_at) >= $1 AND date(s.started_at) <= $2 AND s.completed = 1
    ORDER BY s.started_at ASC
  `,
    [weekStart, weekEnd],
  );
}

export async function getWeekSummary(
  weekStart: string,
  weekEnd: string,
): Promise<WeekSummary> {
  const database = await getDb();
  const rows = await database.select<
    {
      total_seconds: number;
      total_sessions: number;
      work_sessions: number;
      break_sessions: number;
      completed_pomos: number;
    }[]
  >(
    `
    SELECT
      COALESCE(SUM(duration_sec), 0) AS total_seconds,
      COALESCE(COUNT(*), 0) AS total_sessions,
      COALESCE(SUM(CASE WHEN phase = 'work' THEN 1 ELSE 0 END), 0) AS work_sessions,
      COALESCE(SUM(CASE WHEN phase != 'work' THEN 1 ELSE 0 END), 0) AS break_sessions,
      COALESCE(SUM(CASE WHEN phase = 'work' AND pomo_counted = 1 THEN 1 ELSE 0 END), 0) AS completed_pomos
    FROM sessions
    WHERE date(started_at) >= $1 AND date(started_at) <= $2 AND completed = 1
  `,
    [weekStart, weekEnd],
  );

  const raw = rows[0];
  if (!raw || raw.total_sessions === 0) {
    return {
      total_seconds: 0,
      total_sessions: 0,
      work_sessions: 0,
      break_sessions: 0,
      avg_daily_seconds: 0,
      completed_pomos: 0,
      avg_daily_pomos: 0,
      peak_day: null,
      peak_day_seconds: 0,
      peak_day_pomos: 0,
    };
  }

  const dayRows = await database.select<{ d: string; total: number; pomo_count: number }[]>(
    `
    SELECT
      date(started_at) AS d,
      COALESCE(SUM(duration_sec), 0) AS total,
      COUNT(*) AS pomo_count
    FROM sessions
    WHERE date(started_at) >= $1 AND date(started_at) <= $2
      AND completed = 1 AND phase = 'work' AND pomo_counted = 1
    GROUP BY date(started_at)
    ORDER BY pomo_count DESC, total DESC
    LIMIT 1
  `,
    [weekStart, weekEnd],
  );

  const activeDaysRows = await database.select<{ cnt: number }[]>(
    `
    SELECT COUNT(DISTINCT date(started_at)) AS cnt FROM sessions
    WHERE date(started_at) >= $1 AND date(started_at) <= $2
      AND completed = 1 AND phase = 'work' AND pomo_counted = 1
  `,
    [weekStart, weekEnd],
  );
  const activeDays = activeDaysRows[0]?.cnt ?? 0;

  return {
    total_seconds: raw.total_seconds,
    total_sessions: raw.total_sessions,
    work_sessions: raw.work_sessions,
    break_sessions: raw.break_sessions,
    avg_daily_seconds:
      activeDays > 0 ? Math.round(raw.total_seconds / activeDays) : 0,
    completed_pomos: raw.completed_pomos,
    avg_daily_pomos:
      activeDays > 0 ? Math.round((raw.completed_pomos / activeDays) * 10) / 10 : 0,
    peak_day: dayRows[0]?.d ?? null,
    peak_day_seconds: dayRows[0]?.total ?? 0,
    peak_day_pomos: dayRows[0]?.pomo_count ?? 0,
  };
}
