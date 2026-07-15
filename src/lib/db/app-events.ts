import type Database from "@tauri-apps/plugin-sql";
import { getDb } from "./schema";

export interface AppEvent {
  id: number;
  event_name: string;
  route: string | null;
  entity_type: string | null;
  entity_id: string | null;
  metadata: string | null;
  created_at: string;
}

export interface AppEventSummary {
  event_name: string;
  route: string | null;
  event_count: number;
  first_seen_at: string | null;
  last_seen_at: string | null;
}

interface RecordAppEventInput {
  eventName: string;
  route?: string | null;
  entityType?: string | null;
  entityId?: string | number | null;
  metadata?: Record<string, unknown> | null;
}

const MAX_METADATA_LENGTH = 4000;
let ensureAppEventsTablePromise: Promise<void> | null = null;
const appSessionId = createAppSessionId();
let appSessionSequence = 0;

function createAppSessionId(): string {
  const randomId = globalThis.crypto?.randomUUID?.()
    ?? Math.random().toString(36).slice(2);
  return `${Date.now().toString(36)}-${randomId}`;
}

function formatLocalDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function buildEventMetadata(
  metadata?: Record<string, unknown> | null,
): Record<string, unknown> {
  const occurredAt = new Date();
  appSessionSequence += 1;

  return {
    ...(metadata ?? {}),
    appSessionId,
    appSessionSequence,
    clientOccurredAt: occurredAt.toISOString(),
    clientLocalDate: formatLocalDate(occurredAt),
    clientTimezone:
      Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown",
    visibilityState:
      typeof document === "undefined" ? "unknown" : document.visibilityState,
  };
}

function ensureAppEventsTable(database: Database): Promise<void> {
  ensureAppEventsTablePromise ??= (async () => {
    await database.execute(`
      CREATE TABLE IF NOT EXISTS app_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_name TEXT NOT NULL,
        route TEXT,
        entity_type TEXT,
        entity_id TEXT,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await database.execute(
      "CREATE INDEX IF NOT EXISTS idx_app_events_created_at ON app_events(created_at)",
    );
    await database.execute(
      "CREATE INDEX IF NOT EXISTS idx_app_events_event_name ON app_events(event_name)",
    );
    await database.execute(
      "CREATE INDEX IF NOT EXISTS idx_app_events_route ON app_events(route)",
    );
  })();
  return ensureAppEventsTablePromise;
}

function serializeMetadata(metadata?: Record<string, unknown> | null): string | null {
  if (!metadata) return null;

  try {
    const serialized = JSON.stringify(metadata);
    if (serialized.length <= MAX_METADATA_LENGTH) return serialized;
    return JSON.stringify({
      truncated: true,
      originalLength: serialized.length,
      preview: serialized.slice(0, MAX_METADATA_LENGTH),
      appSessionId: metadata.appSessionId,
      appSessionSequence: metadata.appSessionSequence,
      clientOccurredAt: metadata.clientOccurredAt,
      clientLocalDate: metadata.clientLocalDate,
      clientTimezone: metadata.clientTimezone,
      visibilityState: metadata.visibilityState,
    });
  } catch {
    return JSON.stringify({ serializationError: true });
  }
}

export async function recordAppEvent(input: RecordAppEventInput): Promise<void> {
  try {
    const metadata = buildEventMetadata(input.metadata);
    const database = await getDb();
    await ensureAppEventsTable(database);
    await database.execute(
      `INSERT INTO app_events (event_name, route, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        input.eventName,
        input.route ?? null,
        input.entityType ?? null,
        input.entityId == null ? null : String(input.entityId),
        serializeMetadata(metadata),
      ],
    );
  } catch (err) {
    console.warn("[AppEvents] Failed to record event:", err);
  }
}

export async function getRecentAppEvents(limit = 200): Promise<AppEvent[]> {
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 1000);
  const database = await getDb();
  await ensureAppEventsTable(database);
  return database.select<AppEvent[]>(
    `SELECT id, event_name, route, entity_type, entity_id, metadata, created_at
     FROM app_events
     ORDER BY created_at DESC, id DESC
     LIMIT $1`,
    [safeLimit],
  );
}

export async function getAppEventSummary(days = 7): Promise<AppEventSummary[]> {
  const safeDays = Math.min(Math.max(Math.floor(days), 1), 365);
  const database = await getDb();
  await ensureAppEventsTable(database);
  return database.select<AppEventSummary[]>(
    `SELECT
       event_name,
       route,
       COUNT(*) AS event_count,
       MIN(created_at) AS first_seen_at,
       MAX(created_at) AS last_seen_at
     FROM app_events
     WHERE created_at >= datetime('now', 'localtime', $1)
     GROUP BY event_name, route
     ORDER BY event_count DESC, last_seen_at DESC`,
    [`-${safeDays} days`],
  );
}
