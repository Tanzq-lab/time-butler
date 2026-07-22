import Database from "@tauri-apps/plugin-sql";
import { DEFAULT_CATEGORY_COLOR } from "@/lib/constants";
import { seedDefaultTaskCategories } from "./default-categories";
import { invoke, isTauri } from "@/lib/tauri";

const FALLBACK_DB_NAME = "sqlite:Time-butler.db";

let db: Database | null = null;
let dbName: string | null = null;

export async function getDbName(): Promise<string> {
  if (dbName) return dbName;

  if (!isTauri()) {
    dbName = FALLBACK_DB_NAME;
    return dbName;
  }

  dbName = await invoke<string>("private_database_url");
  return dbName;
}

export async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load(await getDbName());
  }
  return db;
}

export async function initDb(): Promise<void> {
  const database = await getDb();

  await database.execute(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      estimated_pomos INTEGER NOT NULL DEFAULT 1,
      completed_pomos INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      archived BOOLEAN DEFAULT 0
    )
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER,
      phase TEXT NOT NULL,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      duration_sec INTEGER NOT NULL,
      completed BOOLEAN NOT NULL DEFAULT 0,
      pomo_counted BOOLEAN NOT NULL DEFAULT 0,
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    )
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '${DEFAULT_CATEGORY_COLOR}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS _schema_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Versioned migrations
  let currentVersion = 0;
  try {
    const rows = await database.select<{ value: string }[]>(
      "SELECT value FROM _schema_meta WHERE key = 'version'",
    );
    if (rows.length > 0) currentVersion = Number(rows[0].value);
  } catch {
    // Fresh database
  }

  const migrations: Record<number, string[]> = {
    1: [
      "ALTER TABLE tasks ADD COLUMN project TEXT",
      "ALTER TABLE tasks ADD COLUMN priority TEXT",
      "ALTER TABLE tasks ADD COLUMN category_id INTEGER",
      "ALTER TABLE sessions ADD COLUMN category_id INTEGER",
      "ALTER TABLE sessions ADD COLUMN intention TEXT",
      "ALTER TABLE sessions ADD COLUMN mood TEXT",
      "ALTER TABLE sessions ADD COLUMN notes TEXT",
    ],
    2: [
      `CREATE TABLE IF NOT EXISTS presets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        work_duration INTEGER NOT NULL,
        short_break_duration INTEGER NOT NULL,
        long_break_duration INTEGER NOT NULL,
        pomos_before_long_break INTEGER NOT NULL DEFAULT 4,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
    ],
    3: [
      "ALTER TABLE tasks ADD COLUMN scheduled_for TEXT",
    ],
    4: [
      "ALTER TABLE tasks ADD COLUMN completed_at TEXT",
      "ALTER TABLE tasks ADD COLUMN completion_review TEXT",
    ],
    5: [],
    7: [
      `CREATE TABLE IF NOT EXISTS time_pages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        date_key TEXT NOT NULL UNIQUE,
        parent_id INTEGER,
        content TEXT NOT NULL DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES time_pages(id)
      )`,
      `CREATE TABLE IF NOT EXISTS week_plan_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        week_page_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        archived INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (week_page_id) REFERENCES time_pages(id)
      )`,
      `CREATE TABLE IF NOT EXISTS task_activity_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        from_value TEXT,
        to_value TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      )`,
      "ALTER TABLE tasks ADD COLUMN week_plan_item_id INTEGER",
    ],
    8: [
      `CREATE TABLE IF NOT EXISTS recurring_task_occurrences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rule_key TEXT NOT NULL,
        occurrence_date TEXT NOT NULL,
        task_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(rule_key, occurrence_date),
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      )`,
    ],
    9: [
      `CREATE TABLE IF NOT EXISTS app_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_name TEXT NOT NULL,
        route TEXT,
        entity_type TEXT,
        entity_id TEXT,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      "CREATE INDEX IF NOT EXISTS idx_app_events_created_at ON app_events(created_at)",
      "CREATE INDEX IF NOT EXISTS idx_app_events_event_name ON app_events(event_name)",
      "CREATE INDEX IF NOT EXISTS idx_app_events_route ON app_events(route)",
    ],
    10: [
      "ALTER TABLE sessions ADD COLUMN pomo_counted BOOLEAN NOT NULL DEFAULT 0",
      "UPDATE sessions SET pomo_counted = 1 WHERE phase = 'work' AND completed = 1",
      `CREATE TRIGGER IF NOT EXISTS trg_sessions_credit_task_pomo
        AFTER UPDATE OF pomo_counted ON sessions
        WHEN OLD.pomo_counted = 0
          AND NEW.pomo_counted = 1
          AND NEW.phase = 'work'
          AND NEW.completed = 1
          AND NEW.task_id IS NOT NULL
        BEGIN
          UPDATE tasks
          SET completed_pomos = completed_pomos + 1
          WHERE id = NEW.task_id;
        END`,
    ],
    11: [
      `CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        completed_at TEXT,
        archived INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX IF NOT EXISTS idx_todos_visible
        ON todos (archived, completed_at, created_at)`,
    ],
    12: [
      "ALTER TABLE todos ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0",
      // Preserve the existing newest-first display order when upgrading.
      `UPDATE todos
       SET sort_order = -id
       WHERE sort_order = 0
         AND NOT EXISTS (SELECT 1 FROM todos WHERE sort_order != 0)`,
      `CREATE INDEX IF NOT EXISTS idx_todos_open_order
        ON todos (archived, completed_at, sort_order)`,
    ],
    13: [
      "ALTER TABLE tasks ADD COLUMN notes TEXT",
    ],
    14: [
      "ALTER TABLE tasks ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0",
      `CREATE INDEX IF NOT EXISTS idx_tasks_visible_order
        ON tasks (archived, sort_order, created_at DESC)`,
    ],
    15: [
      `CREATE TABLE IF NOT EXISTS calendar_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        starts_at DATETIME NOT NULL,
        ends_at DATETIME NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        CHECK (ends_at > starts_at)
      )`,
      "CREATE INDEX IF NOT EXISTS idx_calendar_events_starts_at ON calendar_events(starts_at)",
    ],
  };

  const targetVersion = 15;

  for (let v = currentVersion + 1; v <= targetVersion; v++) {
    const statements = migrations[v];
    if (!statements) continue;
    for (const sql of statements) {
      try {
        await database.execute(sql);
      } catch (e) {
        const msg = (e as Error)?.message ?? "";
        if (!msg.includes("duplicate column")) {
          console.warn(`[DB] Migration v${v} warning:`, msg);
        }
      }
    }
    if (v === 5) {
      await seedDefaultTaskCategories(database);
    }
    await database.execute(
      "INSERT OR REPLACE INTO _schema_meta (key, value) VALUES ('version', $1)",
      [String(v)],
    );
  }

  await seedDefaultTaskCategories(database);

  // Seed default presets if none exist
  const presetCount = await database.select<{ count: number }[]>(
    "SELECT COUNT(*) as count FROM presets",
  );
  if (presetCount[0].count === 0) {
    await database.execute(`
      INSERT INTO presets (name, work_duration, short_break_duration, long_break_duration, pomos_before_long_break)
      VALUES 
        ('经典番茄钟', 1500, 300, 900, 4),
        ('深度工作', 3600, 600, 1800, 3),
        ('心流模式', 5400, 900, 3600, 2),
        ('快速冲刺', 900, 180, 600, 4)
    `);
  }
}
