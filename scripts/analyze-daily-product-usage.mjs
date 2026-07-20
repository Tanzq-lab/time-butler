#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.TZ ||= "Asia/Shanghai";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const defaultDb = path.resolve(repoRoot, "..", "time-butler-data", "Time-butler.db");
const defaultOutputDir = path.resolve(
  repoRoot,
  "..",
  "time-butler-data",
  "data",
  "product-insights",
);

function localDateString(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function yesterday() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return localDateString(date);
}

function readOption(args, index, name) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}

function parseArgs(args) {
  const options = {
    date: yesterday(),
    db: process.env.TIME_BUTLER_DB ?? defaultDb,
    outputDir: process.env.TIME_BUTLER_PRODUCT_INSIGHTS_DIR ?? defaultOutputDir,
    write: true,
    output: "summary",
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--date") {
      options.date = readOption(args, index, arg);
      index += 1;
    } else if (arg === "--db") {
      options.db = readOption(args, index, arg);
      index += 1;
    } else if (arg === "--output-dir") {
      options.outputDir = readOption(args, index, arg);
      index += 1;
    } else if (arg === "--no-write") {
      options.write = false;
    } else if (arg === "--json") {
      options.output = "json";
    } else if (arg === "--markdown") {
      options.output = "markdown";
    } else if (arg === "--help" || arg === "-h") {
      options.output = "help";
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.date)) {
    throw new Error(`Invalid date: ${options.date} (expected YYYY-MM-DD).`);
  }

  return options;
}

function usage() {
  return `Usage: node scripts/analyze-daily-product-usage.mjs [options]

Options:
  --date YYYY-MM-DD  Analyze a local calendar day (default: yesterday)
  --db PATH          Override the Time Butler SQLite database
  --output-dir PATH  Override the private report directory
  --no-write         Print without writing report files
  --json             Print the JSON report
  --markdown         Print the Markdown report
  --help             Show this help`;
}

function sqlQuote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function queryJson(db, sql) {
  const result = spawnSync("sqlite3", ["-readonly", "-json", db, sql], {
    encoding: "utf8",
    env: process.env,
  });

  if (result.status !== 0) {
    const details = [result.stderr, result.stdout].filter(Boolean).join("\n");
    throw new Error(`sqlite3 query failed:\n${details}`);
  }

  const output = result.stdout.trim();
  return output ? JSON.parse(output) : [];
}

function parseMetadata(value) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return { metadataParseError: true };
  }
}

function countBy(items, keyFor) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFor(item);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function round(value, digits = 1) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function percent(part, total) {
  if (!total) return 0;
  return round((part / total) * 100, 1);
}

function formatDuration(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return "0秒";
  const seconds = Math.round(milliseconds / 1000);
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return remainingSeconds ? `${minutes}分${remainingSeconds}秒` : `${minutes}分`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours}小时${remainingMinutes}分` : `${hours}小时`;
}

function eventOccurredAt(event) {
  const clientTime = Date.parse(event.metadata.clientOccurredAt ?? "");
  if (Number.isFinite(clientTime)) return clientTime;
  const databaseTime = Date.parse(`${event.created_at.replace(" ", "T")}Z`);
  return Number.isFinite(databaseTime) ? databaseTime : event.id;
}

function buildRouteStats(events) {
  const routeViews = countBy(
    events.filter((event) => event.event_name === "route_viewed"),
    (event) => event.route ?? "(unknown)",
  );
  const exitsByRoute = new Map();

  for (const event of events.filter((item) => item.event_name === "route_exited")) {
    const route = event.route ?? "(unknown)";
    const current = exitsByRoute.get(route) ?? [];
    current.push(Math.max(0, Number(event.metadata.visibleDurationMs) || 0));
    exitsByRoute.set(route, current);
  }

  const routes = new Set([...routeViews.map((item) => item.key), ...exitsByRoute.keys()]);
  return [...routes]
    .map((route) => {
      const durations = exitsByRoute.get(route) ?? [];
      const totalVisibleMs = sum(durations);
      return {
        route,
        views: routeViews.find((item) => item.key === route)?.count ?? 0,
        measuredExits: durations.length,
        totalVisibleMs,
        averageVisibleMs: durations.length ? Math.round(totalVisibleMs / durations.length) : 0,
        rapidExits: durations.filter((duration) => duration < 3_000).length,
      };
    })
    .sort((a, b) => b.views - a.views || b.totalVisibleMs - a.totalVisibleMs);
}

function buildPaths(events) {
  const groups = new Map();
  for (const event of events) {
    const sessionId = event.metadata.appSessionId;
    if (typeof sessionId !== "string" || !sessionId) continue;
    const group = groups.get(sessionId) ?? [];
    group.push(event);
    groups.set(sessionId, group);
  }

  const sessions = [...groups.entries()].map(([appSessionId, sessionEvents]) => {
    sessionEvents.sort((a, b) => {
      const timeDelta = eventOccurredAt(a) - eventOccurredAt(b);
      if (timeDelta !== 0) return timeDelta;
      const sequenceDelta =
        Number(a.metadata.appSessionSequence ?? 0)
        - Number(b.metadata.appSessionSequence ?? 0);
      return sequenceDelta || a.id - b.id;
    });

    const routes = [];
    for (const event of sessionEvents) {
      if (event.event_name !== "route_viewed" || !event.route) continue;
      if (routes.at(-1) !== event.route) routes.push(event.route);
    }

    const firstAt = eventOccurredAt(sessionEvents[0]);
    const lastAt = eventOccurredAt(sessionEvents.at(-1));
    return {
      appSessionId,
      eventCount: sessionEvents.length,
      routes,
      path: routes.length ? routes.join(" → ") : "(无页面访问事件)",
      elapsedMs: Math.max(0, lastAt - firstAt),
    };
  });

  return {
    sessions,
    topPaths: countBy(sessions, (session) => session.path).slice(0, 8),
  };
}

function buildTransitions(events) {
  return countBy(
    events.filter(
      (event) => event.event_name === "route_viewed"
        && typeof event.metadata.fromRoute === "string",
    ),
    (event) => `${event.metadata.fromRoute} → ${event.route ?? "(unknown)"}`,
  ).slice(0, 10);
}

function buildTaskFlow(events, getCount) {
  const addedByEntity = new Map();
  for (const event of events.filter((item) => item.event_name === "task_added")) {
    if (!event.entity_id) continue;
    const occurredAt = eventOccurredAt(event);
    const existing = addedByEntity.get(event.entity_id);
    if (!existing || occurredAt < existing) addedByEntity.set(event.entity_id, occurredAt);
  }

  const createdThenDeleted = new Map();
  for (const event of events.filter((item) => item.event_name === "task_deleted")) {
    if (!event.entity_id) continue;
    const addedAt = addedByEntity.get(event.entity_id);
    const deletedAt = eventOccurredAt(event);
    if (!Number.isFinite(addedAt) || deletedAt < addedAt) continue;
    const lifetimeMs = deletedAt - addedAt;
    const existing = createdThenDeleted.get(event.entity_id);
    if (!Number.isFinite(existing) || lifetimeMs < existing) {
      createdThenDeleted.set(event.entity_id, lifetimeMs);
    }
  }

  const quickDeleteThresholdMs = 10 * 60 * 1000;
  return {
    added: getCount("task_added"),
    updated: getCount("task_updated"),
    completed: getCount("task_completed"),
    deleted: getCount("task_deleted"),
    archived: getCount("task_archived"),
    createdThenDeleted: createdThenDeleted.size,
    deletedWithin10Minutes: [...createdThenDeleted.values()].filter(
      (lifetimeMs) => lifetimeMs <= quickDeleteThresholdMs,
    ).length,
  };
}

function buildHypotheses({ events, routeStats, timer, tasks, audio, coverage }) {
  const hypotheses = [];
  const push = (hypothesis) => hypotheses.push(hypothesis);

  if (audio.failures > 0 || audio.deliveryGaps > 0) {
    push({
      priority: "high",
      code: "notification_audio_delivery_gap",
      userPath: "计时结束 → 系统通知 → 提示音播放",
      evidence: `${audio.failures} 条失败结果，${audio.deliveryGaps} 次通知未观察到对应音频启动`,
      need: "在离开屏幕或切换工作状态时，可靠感知阶段结束。",
      keyAssumption: "失败事件或同一 attempt 的播放缺口，能定位为音频链路问题而不是用户关闭声音。",
      smallestChange: "先按失败阶段和 AudioContext 状态归因；仅修复出现次数最多且可复现的一段链路。",
      validation: "连续 3 天通知请求均能关联到 started/already_playing，且 failed 为 0。",
      riskBoundary: "不提高音量、不绕过系统权限、不上传音频诊断数据。",
    });
  }

  const timerTerminations = timer.finished + timer.abandoned + timer.skipped;
  const interruptionRate = timerTerminations
    ? (timer.abandoned + timer.skipped) / timerTerminations
    : 0;
  if (timerTerminations >= 3 && interruptionRate >= 0.2) {
    push({
      priority: "medium",
      code: "timer_interruption_cluster",
      userPath: "开始计时 → 保持专注/休息 → 完成或提前结束",
      evidence: `${timer.abandoned + timer.skipped}/${timerTerminations} 次结束为放弃或跳过（${percent(timer.abandoned + timer.skipped, timerTerminations)}%）`,
      need: "用最少操作完成符合当下节奏的计时，而不是反复纠正计时器状态。",
      keyAssumption: "中断集中出现代表流程阻力，而非用户有意使用跳过功能。",
      smallestChange: "先按 phase、经过时长和前后页面分组，确认单一高频模式后再改一个入口。",
      validation: "同类中断率在 7 天滚动窗口下降，完成番茄数不下降。",
      riskBoundary: "不自动续时、不改既有 session、不把正常跳过当失败。",
    });
  }

  const rapidRoute = routeStats.find(
    (route) => route.measuredExits >= 3
      && route.rapidExits / route.measuredExits >= 0.6,
  );
  if (rapidRoute) {
    push({
      priority: "low",
      code: "repeated_rapid_route_exit",
      userPath: `进入 ${rapidRoute.route} → 3 秒内离开`,
      evidence: `${rapidRoute.rapidExits}/${rapidRoute.measuredExits} 次已测访问在 3 秒内离开`,
      need: "快速找到目标信息或动作入口。",
      keyAssumption: "短停留是找不到入口，而不是一次成功的快速查看。",
      smallestChange: "结合离开后的下一页面和实际动作验证；证据一致时只调整一个入口或默认状态。",
      validation: "短停留后立即折返的比例下降，目标动作数不下降。",
      riskBoundary: "单日短停留不直接触发界面改版。",
    });
  }

  if (tasks.deletedWithin10Minutes > 0 && tasks.added > 0) {
    push({
      priority: "low",
      code: "task_create_delete_rework",
      userPath: "创建任务 → 调整/使用 → 删除任务",
      evidence: `创建 ${tasks.added} 个任务；其中 ${tasks.createdThenDeleted} 个当天删除，${tasks.deletedWithin10Minutes} 个在 10 分钟内删除`,
      need: "一次创建出可执行、分类正确且时间安排合理的任务。",
      keyAssumption: "新建后 10 分钟内删除来自录入返工，而非一次有意的临时任务。",
      smallestChange: "结合新增时的字段完整度和删除前动作，确认快速删除集中在哪一种录入路径。",
      validation: "新建 10 分钟内删除率下降，任务完成率不下降。",
      riskBoundary: "不恢复或重写已删除任务。",
    });
  }

  if (coverage.sessionizedPercent < 80) {
    push({
      priority: "observe",
      code: "instrumentation_warmup",
      userPath: "打开 App → 浏览页面 → 执行任务/计时动作",
      evidence: `仅 ${coverage.sessionizedPercent}% 事件包含会话字段`,
      need: "先获得足够完整的路径证据，再判断体验问题。",
      keyAssumption: "低覆盖主要来自埋点启用前的旧事件或 App 未重新加载。",
      smallestChange: "保持当前埋点运行，不据此改产品；次日再次检查覆盖率。",
      validation: "完整自然日的会话字段覆盖率达到 90% 以上。",
      riskBoundary: "不把数据缺失解释成用户流失。",
    });
  }

  if (hypotheses.length === 0 && events.length > 0) {
    push({
      priority: "observe",
      code: "no_repeated_friction_yet",
      userPath: "当日主要使用路径",
      evidence: "当前阈值下未发现重复且可定位的阻力信号。",
      need: "保持顺畅使用，同时积累跨日证据。",
      keyAssumption: "没有命中阈值不等于没有问题，只代表今天不值得据此改行为。",
      smallestChange: "不改产品；继续观察 7 天滚动路径和用户明确反馈。",
      validation: "后续信号需至少由两类本地证据互相印证。",
      riskBoundary: "不为填满建议而制造优化项。",
    });
  }

  return hypotheses.slice(0, 3);
}

function buildMarkdown(report) {
  const lines = [
    `# Time Butler 每日产品使用分析：${report.date}`,
    "",
    `生成时间：${report.generatedAt}`,
    "",
    "> 本报告仅使用本地聚合事件与状态字段，不包含任务名称、笔记正文、日报正文或完成复盘原文。单日数据用于发现候选阻力，不直接证明用户需求。",
    "",
    "## 数据覆盖",
    "",
    `- 事件：${report.coverage.eventCount} 条；带 App 会话字段：${report.coverage.sessionizedEventCount} 条（${report.coverage.sessionizedPercent}%）`,
    `- App 使用会话：${report.coverage.appSessionCount} 个；页面退出停留样本：${report.coverage.measuredRouteExits} 个`,
    `- App 会话事件：开始 ${report.coverage.appSessionStartedCount} 条，结束 ${report.coverage.appSessionEndedCount} 条（跨日或异常退出可能不成对）`,
    `- 数据库交叉验证：完成计时 ${report.databaseSignals.sessions.completed} 次、未完成计时记录 ${report.databaseSignals.sessions.incomplete} 次、创建任务 ${report.databaseSignals.tasks.created} 个、完成任务 ${report.databaseSignals.tasks.completed} 个`,
    "",
    "## 使用路径",
    "",
  ];

  if (report.paths.top.length === 0) {
    lines.push("- 暂无可重建的会话路径；会话埋点可能尚未覆盖这个日期。");
  } else {
    for (const pathItem of report.paths.top) {
      lines.push(`- ${pathItem.path}：${pathItem.count} 次`);
    }
  }

  lines.push("", "常见页面跳转：");
  if (report.transitions.length === 0) {
    lines.push("- 暂无跨页面跳转。");
  } else {
    for (const transition of report.transitions.slice(0, 6)) {
      lines.push(`- ${transition.transition}：${transition.count} 次`);
    }
  }

  lines.push("", "## 页面停留", "");
  if (report.routes.length === 0) {
    lines.push("- 当日没有页面访问事件。");
  } else {
    for (const route of report.routes) {
      const dwell = route.measuredExits
        ? `，已测有效停留 ${formatDuration(route.totalVisibleMs)}，平均 ${formatDuration(route.averageVisibleMs)}`
        : "，暂无退出停留样本";
      lines.push(`- ${route.route}：访问 ${route.views} 次${dwell}`);
    }
  }

  lines.push(
    "",
    "## 关键动作",
    "",
    `- 计时：开始 ${report.flows.timer.started}，完成 ${report.flows.timer.finished}，放弃 ${report.flows.timer.abandoned}，跳过 ${report.flows.timer.skipped}`,
    `- 任务：创建 ${report.flows.tasks.added}，更新 ${report.flows.tasks.updated}，完成 ${report.flows.tasks.completed}，删除 ${report.flows.tasks.deleted}，归档 ${report.flows.tasks.archived}；当天新增后删除 ${report.flows.tasks.createdThenDeleted}，其中 10 分钟内删除 ${report.flows.tasks.deletedWithin10Minutes}`,
    `- 音频通知：请求 ${report.flows.audio.deliveryRequested}，播放启动/已播放 ${report.flows.audio.playbackObserved}，失败 ${report.flows.audio.failures}，缺口 ${report.flows.audio.deliveryGaps}`,
  );

  for (const failure of report.flows.audio.failureDetails) {
    const context = [failure.trigger, failure.phase].filter(Boolean).join(" / ");
    const error = [failure.errorName, failure.errorMessage]
      .filter(Boolean)
      .join(": ");
    lines.push(
      `  - 失败诊断：${failure.eventName}${context ? `（${context}）` : ""}${error ? `｜${error}` : ""}`,
    );
  }

  lines.push("", "## 产品假设队列", "");

  if (report.hypotheses.length === 0) {
    lines.push("- 数据不足，今天不提出产品改动建议。");
  } else {
    report.hypotheses.forEach((hypothesis, index) => {
      lines.push(
        `### ${index + 1}. ${hypothesis.code}（${hypothesis.priority}）`,
        "",
        `- 用户路径：${hypothesis.userPath}`,
        `- 证据：${hypothesis.evidence}`,
        `- 提炼需求：${hypothesis.need}`,
        `- 关键假设：${hypothesis.keyAssumption}`,
        `- 最小变化：${hypothesis.smallestChange}`,
        `- 验证：${hypothesis.validation}`,
        `- 风险边界：${hypothesis.riskBoundary}`,
        "",
      );
    });
  }

  return `${lines.join("\n").trim()}\n`;
}

function analyze(options) {
  if (!fs.existsSync(options.db)) {
    throw new Error(`Time Butler database does not exist: ${options.db}`);
  }

  const dateSql = sqlQuote(options.date);
  const rawEvents = queryJson(
    options.db,
    `SELECT id, event_name, route, entity_type, entity_id, metadata, created_at
     FROM app_events
     WHERE COALESCE(
       json_extract(metadata, '$.clientLocalDate'),
       date(created_at, 'localtime')
     ) = ${dateSql}
     ORDER BY id ASC;`,
  );
  const events = rawEvents.map((event) => ({
    ...event,
    metadata: parseMetadata(event.metadata),
  }));

  const sessionRows = queryJson(
    options.db,
    `SELECT
       SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS completed,
       SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) AS incomplete,
       SUM(CASE WHEN completed = 1 THEN duration_sec ELSE 0 END) AS completed_seconds
     FROM sessions
     WHERE date(started_at) = ${dateSql};`,
  );
  const taskRows = queryJson(
    options.db,
    `SELECT
       SUM(CASE WHEN date(created_at, 'localtime') = ${dateSql} THEN 1 ELSE 0 END) AS created,
       SUM(CASE WHEN date(completed_at) = ${dateSql} THEN 1 ELSE 0 END) AS completed
     FROM tasks;`,
  );

  const eventCounts = Object.fromEntries(
    countBy(events, (event) => event.event_name).map(({ key, count }) => [key, count]),
  );
  const getCount = (eventName) => Number(eventCounts[eventName] ?? 0);
  const routeStats = buildRouteStats(events);
  const pathData = buildPaths(events);
  const sessionizedEventCount = events.filter(
    (event) => typeof event.metadata.appSessionId === "string",
  ).length;
  const timer = {
    started: getCount("timer_session_started"),
    finished: getCount("timer_session_finished"),
    abandoned: getCount("timer_session_abandoned"),
    skipped: getCount("timer_session_skipped"),
  };
  const tasks = buildTaskFlow(events, getCount);
  const audioEvents = events.filter((event) => event.event_name.startsWith("notification_"));
  const audioFailureEvents = audioEvents.filter((event) =>
    ["failed", "not_running"].includes(String(event.metadata.outcome)),
  );
  const audioFailureDetails = audioFailureEvents.slice(0, 3).map((event) => ({
    eventName: event.event_name,
    trigger: event.metadata.trigger ?? null,
    phase: event.metadata.phase ?? null,
    outcome: event.metadata.outcome ?? null,
    errorName: event.metadata.errorName ?? null,
    errorMessage:
      typeof event.metadata.errorMessage === "string"
        ? event.metadata.errorMessage.slice(0, 200)
        : null,
  }));
  const requestedAttempts = new Set(
    audioEvents
      .filter((event) => event.event_name === "notification_delivery_requested")
      .map((event) => event.metadata.attemptId)
      .filter(Boolean),
  );
  const playbackAttempts = new Set(
    audioEvents
      .filter(
        (event) => event.event_name === "notification_audio_playback_result"
          && ["started", "already_playing"].includes(String(event.metadata.outcome)),
      )
      .map((event) => event.metadata.attemptId)
      .filter(Boolean),
  );
  const deliveryGaps = [...requestedAttempts].filter(
    (attemptId) => !playbackAttempts.has(attemptId),
  ).length;
  const audio = {
    deliveryRequested: requestedAttempts.size,
    playbackObserved: playbackAttempts.size,
    failures: audioFailureEvents.length,
    failureDetails: audioFailureDetails,
    deliveryGaps,
  };
  const coverage = {
    eventCount: events.length,
    sessionizedEventCount,
    sessionizedPercent: percent(sessionizedEventCount, events.length),
    appSessionCount: pathData.sessions.length,
    appSessionStartedCount: getCount("app_usage_session_started"),
    appSessionEndedCount: getCount("app_usage_session_ended"),
    measuredRouteExits: sum(routeStats.map((route) => route.measuredExits)),
  };
  const databaseSignals = {
    sessions: {
      completed: Number(sessionRows[0]?.completed ?? 0),
      incomplete: Number(sessionRows[0]?.incomplete ?? 0),
      completedSeconds: Number(sessionRows[0]?.completed_seconds ?? 0),
    },
    tasks: {
      created: Number(taskRows[0]?.created ?? 0),
      completed: Number(taskRows[0]?.completed ?? 0),
    },
  };

  const report = {
    schemaVersion: 2,
    date: options.date,
    generatedAt: new Date().toISOString(),
    privacy: {
      localOnly: true,
      excludedContent: [
        "task names",
        "notes content",
        "daily/weekly/monthly page content",
        "completion review content",
      ],
    },
    coverage,
    eventCounts,
    paths: {
      top: pathData.topPaths.map((item) => ({ path: item.key, count: item.count })),
      sessions: pathData.sessions,
    },
    transitions: buildTransitions(events).map((item) => ({
      transition: item.key,
      count: item.count,
    })),
    routes: routeStats,
    flows: { timer, tasks, audio },
    databaseSignals,
  };
  report.hypotheses = buildHypotheses({
    events,
    routeStats,
    timer,
    tasks,
    audio,
    coverage,
  });
  report.markdown = buildMarkdown(report);
  return report;
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.output === "help") {
    console.log(usage());
    process.exit(0);
  }

  const report = analyze(options);
  let jsonPath = null;
  let markdownPath = null;

  if (options.write) {
    fs.mkdirSync(options.outputDir, { recursive: true });
    jsonPath = path.join(options.outputDir, `${options.date}.json`);
    markdownPath = path.join(options.outputDir, `${options.date}.md`);
    const jsonReport = { ...report };
    delete jsonReport.markdown;
    fs.writeFileSync(jsonPath, `${JSON.stringify(jsonReport, null, 2)}\n`);
    fs.writeFileSync(markdownPath, report.markdown);
  }

  if (options.output === "json") {
    const jsonReport = { ...report };
    delete jsonReport.markdown;
    console.log(JSON.stringify(jsonReport, null, 2));
  } else if (options.output === "markdown") {
    process.stdout.write(report.markdown);
  } else {
    console.log(
      `Analyzed ${options.date}: ${report.coverage.eventCount} events, ${report.coverage.appSessionCount} app sessions, ${report.hypotheses.length} hypotheses.`,
    );
    if (markdownPath) console.log(`Markdown: ${markdownPath}`);
    if (jsonPath) console.log(`JSON: ${jsonPath}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
