/// <reference types="node" />

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
      INSERT INTO app_events (event_name, route, entity_type, entity_id, metadata, created_at) VALUES
        ('app_usage_session_started', '/', NULL, NULL, '${metadata({ appSessionId: "session-1", appSessionSequence: 1, clientLocalDate: "2026-07-14", clientOccurredAt: "2026-07-14T01:00:00.000Z" })}', '2026-07-14 01:00:00'),
        ('route_viewed', '/', NULL, NULL, '${metadata({ appSessionId: "session-1", appSessionSequence: 2, clientLocalDate: "2026-07-14", clientOccurredAt: "2026-07-14T01:00:01.000Z", fromRoute: null })}', '2026-07-14 01:00:01'),
        ('route_exited', '/', NULL, NULL, '${metadata({ appSessionId: "session-1", appSessionSequence: 3, clientLocalDate: "2026-07-14", clientOccurredAt: "2026-07-14T01:00:11.000Z", visibleDurationMs: 10000 })}', '2026-07-14 01:00:11'),
        ('route_viewed', '/tasks', NULL, NULL, '${metadata({ appSessionId: "session-1", appSessionSequence: 4, clientLocalDate: "2026-07-14", clientOccurredAt: "2026-07-14T01:00:12.000Z", fromRoute: "/" })}', '2026-07-14 01:00:12'),
        ('task_added', '/tasks', 'task', '101', '${metadata({ appSessionId: "session-1", appSessionSequence: 5, clientLocalDate: "2026-07-14", clientOccurredAt: "2026-07-14T01:00:13.000Z" })}', '2026-07-14 01:00:13'),
        ('task_deleted', '/tasks', 'task', '98', '${metadata({ appSessionId: "session-1", appSessionSequence: 6, clientLocalDate: "2026-07-14", clientOccurredAt: "2026-07-14T01:00:14.000Z" })}', '2026-07-14 01:00:14'),
        ('task_deleted', '/tasks', 'task', '99', '${metadata({ appSessionId: "session-1", appSessionSequence: 7, clientLocalDate: "2026-07-14", clientOccurredAt: "2026-07-14T01:00:15.000Z" })}', '2026-07-14 01:00:15'),
        ('time_page_selected', '/notes', 'time_page', '37', '${metadata({ appSessionId: "session-1", appSessionSequence: 8, clientLocalDate: "2026-07-14", clientOccurredAt: "2026-07-14T01:00:16.000Z", pageType: "day", dateKey: "2026-07-14" })}', '2026-07-14 01:00:16'),
        ('time_page_content_updated', '/notes', 'time_page', '37', '${metadata({ appSessionId: "session-1", appSessionSequence: 9, clientLocalDate: "2026-07-14", clientOccurredAt: "2026-07-14T01:00:17.000Z", pageType: "day", dateKey: "2026-07-14", deltaLength: 0 })}', '2026-07-14 01:00:17'),
        ('time_page_content_updated', '/notes', 'time_page', '37', '${metadata({ appSessionId: "session-1", appSessionSequence: 10, clientLocalDate: "2026-07-14", clientOccurredAt: "2026-07-14T01:00:18.000Z", pageType: "day", dateKey: "2026-07-14", deltaLength: 2 })}', '2026-07-14 01:00:18'),
        ('notification_audio_prepare_result', '/', NULL, NULL, '${metadata({ appSessionId: "session-1", appSessionSequence: 11, clientLocalDate: "2026-07-14", clientOccurredAt: "2026-07-14T01:00:19.000Z", trigger: "timer_start", phase: "short_break", outcome: "failed", errorName: "ReferenceError", errorMessage: "Missing audio buffer" })}', '2026-07-14 01:00:19'),
        ('app_usage_session_ended', '/tasks', NULL, NULL, '${metadata({ appSessionId: "session-1", appSessionSequence: 12, clientLocalDate: "2026-07-14", clientOccurredAt: "2026-07-14T01:00:20.000Z" })}', '2026-07-14 01:00:20');
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
      eventCount: 12,
      sessionizedEventCount: 12,
      appSessionCount: 1,
      appSessionStartedCount: 1,
      appSessionEndedCount: 1,
      measuredRouteExits: 1,
    });
    expect(report.paths.top).toEqual([{ path: "/ → /tasks", count: 1 }]);
    expect(report.transitions).toContainEqual({
      transition: "/ → /tasks",
      count: 1,
    });
    expect(report.flows.audio).toMatchObject({
      failures: 1,
      failureDetails: [
        {
          eventName: "notification_audio_prepare_result",
          trigger: "timer_start",
          phase: "short_break",
          outcome: "failed",
          errorName: "ReferenceError",
          errorMessage: "Missing audio buffer",
        },
      ],
    });
    expect(report.flows.tasks).toMatchObject({
      added: 1,
      deleted: 2,
      createdThenDeleted: 0,
      deletedWithin10Minutes: 0,
    });
    expect(report.flows.timePages).toMatchObject({
      selected: 1,
      updated: 2,
      pagesTouched: 1,
      zeroDeltaUpdates: 1,
      tinyDeltaUpdates: 2,
      netDelta: 2,
    });
    expect(report.hypotheses).not.toContainEqual(
      expect.objectContaining({ code: "task_create_delete_rework" }),
    );
    expect(JSON.stringify(report)).not.toContain("PRIVATE TASK NAME");
    expect(report.markdown).toBeUndefined();

    const markdownResult = spawnSync(
      process.execPath,
      [
        path.join(repoRoot, "scripts/analyze-daily-product-usage.mjs"),
        "--date",
        "2026-07-14",
        "--db",
        database,
        "--no-write",
        "--markdown",
      ],
      { encoding: "utf8", env: { ...process.env, TZ: "Asia/Shanghai" } },
    );
    expect(markdownResult.status, markdownResult.stderr).toBe(0);
    expect(markdownResult.stdout).toContain(
      "App 会话事件：开始 1 条，结束 1 条（跨日或异常退出可能不成对）",
    );
    expect(markdownResult.stdout).toContain(
      "时间页：选择 1，内容更新 2，涉及 1 个页面；零长度变化 1，长度变化不超过 2 字符 2",
    );
  });

  it("reports destinations after repeated rapid route exits", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "time-butler-usage-"));
    temporaryDirectories.push(directory);
    const database = path.join(directory, "fixture.db");
    const historicalRoute = {
      route: "/notes",
      measuredExits: 4,
      rapidExits: 3,
    };
    for (const date of ["2026-07-18", "2026-07-19"]) {
      writeFileSync(
        path.join(directory, `${date}.json`),
        JSON.stringify({ date, routes: [historicalRoute] }),
      );
    }
    const metadata = (value: Record<string, unknown>) =>
      JSON.stringify(value).replaceAll("'", "''");
    const eventMetadata = (sequence: number, extra: Record<string, unknown> = {}) =>
      metadata({
        appSessionId: "session-rapid-exits",
        appSessionSequence: sequence,
        clientLocalDate: "2026-07-20",
        clientOccurredAt: `2026-07-20T01:00:${String(sequence).padStart(2, "0")}.000Z`,
        ...extra,
      });
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
        ('route_viewed', '/notes', '${eventMetadata(1)}', '2026-07-20 01:00:01'),
        ('route_exited', '/notes', '${eventMetadata(2, { visibleDurationMs: 900 })}', '2026-07-20 01:00:02'),
        ('route_viewed', '/calendar', '${eventMetadata(3, { fromRoute: "/notes" })}', '2026-07-20 01:00:03'),
        ('route_viewed', '/notes', '${eventMetadata(4, { fromRoute: "/calendar" })}', '2026-07-20 01:00:04'),
        ('route_exited', '/notes', '${eventMetadata(5, { visibleDurationMs: 1200 })}', '2026-07-20 01:00:05'),
        ('route_viewed', '/calendar', '${eventMetadata(6, { fromRoute: "/notes" })}', '2026-07-20 01:00:06'),
        ('route_viewed', '/notes', '${eventMetadata(7, { fromRoute: "/calendar" })}', '2026-07-20 01:00:07'),
        ('route_exited', '/notes', '${eventMetadata(8, { visibleDurationMs: 700 })}', '2026-07-20 01:00:08'),
        ('route_viewed', '/tasks', '${eventMetadata(9, { fromRoute: "/notes" })}', '2026-07-20 01:00:09');
    `;
    const setup = spawnSync("sqlite3", [database, sql], { encoding: "utf8" });
    expect(setup.status, setup.stderr).toBe(0);

    const result = spawnSync(
      process.execPath,
      [
        path.join(repoRoot, "scripts/analyze-daily-product-usage.mjs"),
        "--date",
        "2026-07-20",
        "--db",
        database,
        "--output-dir",
        directory,
        "--no-write",
        "--json",
      ],
      { encoding: "utf8", env: { ...process.env, TZ: "Asia/Shanghai" } },
    );
    expect(result.status, result.stderr).toBe(0);

    const report = JSON.parse(result.stdout);
    expect(report.schemaVersion).toBe(4);
    expect(report.routes.find((route: { route: string }) => route.route === "/notes"))
      .toMatchObject({
        rapidExits: 3,
        rapidExitDestinations: [
          { route: "/calendar", count: 2 },
          { route: "/tasks", count: 1 },
        ],
      });
    expect(report.hypotheses).toContainEqual(
      expect.objectContaining({
        code: "repeated_rapid_route_exit",
        evidence: expect.stringContaining("近 3 个有报告的自然日中 3 天命中同一阈值"),
        smallestChange: expect.stringContaining("3 日观察窗口已满足"),
      }),
    );
  });
});
