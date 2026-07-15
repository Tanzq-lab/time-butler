/// <reference types="node" />

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const temporaryDirectories: string[] = [];

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    rmSync(temporaryDirectories.pop()!, { recursive: true, force: true });
  }
});

describe("daily product usage analyzer", () => {
  it("reconstructs local paths and keeps private content out of the report", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "time-butler-usage-"));
    temporaryDirectories.push(directory);
    const database = path.join(directory, "fixture.db");
    const metadata = (value: Record<string, unknown>) =>
      JSON.stringify(value).replaceAll("'", "''");
    const sql = `
      CREATE TABLE app_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_name TEXT NOT NULL,
        route TEXT,
        entity_type TEXT,
        entity_id TEXT,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE sessions (
        id INTEGER PRIMARY KEY,
        started_at TEXT,
        duration_sec INTEGER,
        completed INTEGER
      );
      CREATE TABLE tasks (
        id INTEGER PRIMARY KEY,
        name TEXT,
        created_at TEXT,
        completed_at TEXT
      );
      INSERT INTO app_events (event_name, route, metadata, created_at) VALUES
        ('app_usage_session_started', '/', '${metadata({ appSessionId: "session-1", appSessionSequence: 1, clientLocalDate: "2026-07-14", clientOccurredAt: "2026-07-14T01:00:00.000Z" })}', '2026-07-14 01:00:00'),
        ('route_viewed', '/', '${metadata({ appSessionId: "session-1", appSessionSequence: 2, clientLocalDate: "2026-07-14", clientOccurredAt: "2026-07-14T01:00:01.000Z", fromRoute: null })}', '2026-07-14 01:00:01'),
        ('route_exited', '/', '${metadata({ appSessionId: "session-1", appSessionSequence: 3, clientLocalDate: "2026-07-14", clientOccurredAt: "2026-07-14T01:00:11.000Z", visibleDurationMs: 10000 })}', '2026-07-14 01:00:11'),
        ('route_viewed', '/tasks', '${metadata({ appSessionId: "session-1", appSessionSequence: 4, clientLocalDate: "2026-07-14", clientOccurredAt: "2026-07-14T01:00:12.000Z", fromRoute: "/" })}', '2026-07-14 01:00:12'),
        ('task_added', '/tasks', '${metadata({ appSessionId: "session-1", appSessionSequence: 5, clientLocalDate: "2026-07-14", clientOccurredAt: "2026-07-14T01:00:13.000Z" })}', '2026-07-14 01:00:13');
      INSERT INTO sessions VALUES (1, '2026-07-14 09:00:00', 1500, 1);
      INSERT INTO tasks VALUES (1, 'PRIVATE TASK NAME', '2026-07-14 01:00:00', NULL);
    `;
    const setup = spawnSync("sqlite3", [database, sql], { encoding: "utf8" });
    expect(setup.status, setup.stderr).toBe(0);

    const result = spawnSync(
      process.execPath,
      [
        path.join(repoRoot, "scripts/analyze-daily-product-usage.mjs"),
        "--date",
        "2026-07-14",
        "--db",
        database,
        "--no-write",
        "--json",
      ],
      { encoding: "utf8", env: { ...process.env, TZ: "Asia/Shanghai" } },
    );
    expect(result.status, result.stderr).toBe(0);

    const report = JSON.parse(result.stdout);
    expect(report.coverage).toMatchObject({
      eventCount: 5,
      sessionizedEventCount: 5,
      appSessionCount: 1,
      measuredRouteExits: 1,
    });
    expect(report.paths.top).toEqual([{ path: "/ → /tasks", count: 1 }]);
    expect(report.transitions).toContainEqual({
      transition: "/ → /tasks",
      count: 1,
    });
    expect(JSON.stringify(report)).not.toContain("PRIVATE TASK NAME");
  });
});
