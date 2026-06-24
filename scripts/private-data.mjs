#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const defaultDataRoot = path.resolve(repoRoot, "..", "time-butler-data");
const dataRoot = path.resolve(process.env.TIME_BUTLER_DATA_DIR ?? defaultDataRoot);
const appSupportDir = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "com.timebutler.desktop",
);
const runtimeDb = path.resolve(
  process.env.TIME_BUTLER_DB ?? path.join(appSupportDir, "Kairos-Pomodoro.db"),
);
const sourceLog = path.join(repoRoot, "data", "pomodoro-estimation-log.jsonl");
const targetDb = path.join(dataRoot, "Kairos-Pomodoro.db");
const targetLog = path.join(dataRoot, "data", "pomodoro-estimation-log.jsonl");

function usage() {
  console.log(`Usage: node scripts/private-data.mjs <init|backup>

Defaults:
  data root: ${dataRoot}
  runtime DB: ${runtimeDb}

Overrides:
  TIME_BUTLER_DATA_DIR=/path/to/time-butler-data
  TIME_BUTLER_DB=/path/to/Kairos-Pomodoro.db`);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function ensureFileIfMissing(file, content) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, content);
  }
}

function initDataRoot() {
  ensureDir(dataRoot);
  ensureDir(path.join(dataRoot, "data"));
  ensureDir(path.join(dataRoot, "backups"));
  ensureFileIfMissing(
    path.join(dataRoot, ".gitignore"),
    [".DS_Store", "*.db-shm", "*.db-wal", ""].join("\n"),
  );

  console.log(`Data root ready: ${dataRoot}`);
  console.log(`Private DB path: ${targetDb}`);
  console.log(`Private log path: ${targetLog}`);
}

function timestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
}

function quoteForSqliteDotCommand(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function runSqliteBackup(source, destination) {
  const result = spawnSync(
    "sqlite3",
    [source, ".timeout 5000", `.backup ${quoteForSqliteDotCommand(destination)}`],
    { encoding: "utf8" },
  );

  if (result.status !== 0) {
    const details = [result.stderr, result.stdout].filter(Boolean).join("\n");
    throw new Error(`sqlite3 backup failed:\n${details}`);
  }
}

function backupExistingPrivateDb() {
  if (!fs.existsSync(targetDb)) return null;
  const backupPath = path.join(
    dataRoot,
    "backups",
    `Kairos-Pomodoro.before-backup-${timestamp()}.db`,
  );
  fs.copyFileSync(targetDb, backupPath);
  return backupPath;
}

function readJsonlLines(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function mergeEstimationLog() {
  if (!fs.existsSync(sourceLog)) {
    if (fs.existsSync(targetLog)) {
      console.log(`No new public log to merge; kept: ${targetLog}`);
    } else {
      console.log("No estimation log found yet.");
    }
    return;
  }

  const privateLines = readJsonlLines(targetLog);
  const publicLines = readJsonlLines(sourceLog);
  const seen = new Set(privateLines);
  const missing = publicLines.filter((line) => {
    if (seen.has(line)) return false;
    seen.add(line);
    return true;
  });

  ensureDir(path.dirname(targetLog));
  const merged = [...privateLines, ...missing];
  fs.writeFileSync(targetLog, merged.length > 0 ? `${merged.join("\n")}\n` : "");
  fs.rmSync(sourceLog);

  console.log(
    `Merged ${missing.length} new estimation log line(s) into: ${targetLog}`,
  );
  console.log(`Removed public staging log: ${sourceLog}`);
}

function backupData() {
  initDataRoot();

  if (!fs.existsSync(runtimeDb)) {
    throw new Error(`Runtime database does not exist: ${runtimeDb}`);
  }

  const previousBackup = backupExistingPrivateDb();
  if (previousBackup) {
    console.log(`Saved previous private DB snapshot: ${previousBackup}`);
  }

  runSqliteBackup(runtimeDb, targetDb);
  console.log(`Backed up runtime DB to: ${targetDb}`);

  mergeEstimationLog();
}

const command = process.argv[2] ?? "init";

try {
  if (command === "init") {
    initDataRoot();
  } else if (command === "backup") {
    backupData();
  } else {
    usage();
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
