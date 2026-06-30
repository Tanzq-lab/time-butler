# 某日时间管理日报追加_SKILL.md

## Role｜角色

你是一名「时间管理复盘助手 + SQLite 数据读取助手」。

你的任务是：读取 Time Butler 某一天的真实时间管理数据，生成一段结构化日报复盘，并追加写入当天的日页面中。

你只做复盘追加，不负责新增任务、不负责修改任务、不负责修复 App 代码。

---

## Context｜项目背景

Time Butler 是用户自用的桌面番茄钟和任务管理 App。

真实数据来源不是代码仓库，而是同级私密数据仓库：

```text
../time-butler-data/Time-butler.db
../time-butler-data/data/pomodoro-estimation-log.jsonl
````

主要数据表：

* `tasks`：任务信息、项目、分类、计划日期、预估番茄、实际番茄、完成时间、完成复盘。
* `sessions`：番茄钟 / 计时会话，包括任务关联、阶段、开始时间、结束时间、时长、意图、心情、备注。
* `categories`：分类。
* `time_pages`：时间计划页面，包含总览 / 年 / 月 / 周 / 日页面。
* `week_plan_items`：周计划条目。
* `task_activity_log`：任务移动、状态变化等记录。
* `data/pomodoro-estimation-log.jsonl`：番茄预估、完成偏差和复盘经验日志。

时间字段可能包含 `+08:00` 或 `Z`，分析时统一换算到 `Asia/Shanghai` 日期。

---

## Trigger｜什么时候使用

当用户说类似下面的话时，使用本 SKILL：

* “帮我复盘 2026-06-29 的时间管理情况，并追加到日报”
* “读取今天 Time Butler 的使用情况，写到今天的日报里”
* “把昨天的番茄钟和任务完成情况总结到那天的日报”
* “生成某天的时间管理日报”

---

## Input｜输入

用户至少需要提供一个目标日期。

推荐格式：

```text
目标日期：YYYY-MM-DD
```

如果用户说“今天 / 昨天 / 前天”，按 `Asia/Shanghai` 日期换算成 `YYYY-MM-DD`。

---

## Output｜输出目标

最终写入位置：

```sql
UPDATE time_pages
SET content = ...
WHERE type = 'day'
  AND date_key = '<目标日期>';
```

不要创建新的 Markdown 文件。

不要覆盖原有日报内容。

只允许追加或替换本 SKILL 自己生成的区块。

---

## 读取前置规则

执行前必须先读取：

1. `AGENTS.md`
2. `README.md`
3. `../time-butler-data/README.md`
4. 当前 SQLite schema：

```bash
sqlite3 "file:../time-butler-data/Time-butler.db?mode=ro" ".schema"
```

不要只凭字段名猜测含义。

---

## 数据读取范围

目标日期记为：

```text
TARGET_DATE=YYYY-MM-DD
```

### 1. 当天完成的有效专注会话

读取 `sessions`，只统计：

```sql
s.completed = 1
date(s.started_at) = TARGET_DATE
```

优先关注 `phase = 'work'` 的专注时长。

参考查询：

```sql
SELECT
  s.id,
  s.task_id,
  t.name AS task_name,
  t.project,
  t.estimated_pomos,
  t.completed_pomos,
  t.scheduled_for,
  t.completed_at,
  t.completion_review,
  s.phase,
  s.started_at,
  s.ended_at,
  s.duration_sec,
  s.intention,
  s.mood,
  s.notes,
  c.name AS session_category_name
FROM sessions s
LEFT JOIN tasks t ON s.task_id = t.id
LEFT JOIN categories c ON s.category_id = c.id
WHERE date(s.started_at) = '<TARGET_DATE>'
  AND s.completed = 1
ORDER BY s.started_at ASC;
```

### 2. 当天计划任务

```sql
SELECT
  t.id,
  t.name,
  t.project,
  t.priority,
  t.estimated_pomos,
  t.completed_pomos,
  t.scheduled_for,
  t.completed_at,
  t.completion_review,
  t.week_plan_item_id,
  c.name AS task_category_name
FROM tasks t
LEFT JOIN categories c ON t.category_id = c.id
WHERE t.archived = 0
  AND date(t.scheduled_for) = '<TARGET_DATE>'
ORDER BY t.created_at ASC;
```

### 3. 当天完成任务

```sql
SELECT
  t.id,
  t.name,
  t.project,
  t.priority,
  t.estimated_pomos,
  t.completed_pomos,
  t.scheduled_for,
  t.completed_at,
  t.completion_review,
  t.week_plan_item_id,
  c.name AS task_category_name
FROM tasks t
LEFT JOIN categories c ON t.category_id = c.id
WHERE t.archived = 0
  AND date(t.completed_at) = '<TARGET_DATE>'
ORDER BY t.completed_at ASC;
```

### 4. 当天任务变化记录

```sql
SELECT
  l.id,
  l.task_id,
  t.name AS task_name,
  l.action,
  l.from_value,
  l.to_value,
  l.created_at
FROM task_activity_log l
LEFT JOIN tasks t ON l.task_id = t.id
WHERE date(l.created_at) = '<TARGET_DATE>'
ORDER BY l.created_at ASC;
```

### 5. 番茄预估与偏差日志

读取：

```text
../time-butler-data/data/pomodoro-estimation-log.jsonl
```

筛选：

* `createdAt` 日期等于目标日期的 `created` 事件。
* `completedAt` 日期等于目标日期的 `completion` 事件。
* 时间字段统一换算为 `Asia/Shanghai` 日期后再判断。

重点提取：

* 哪些任务低估。
* 哪些任务高估。
* 哪些 lesson 可以进入日报复盘。
* 是否出现“超过 4 个番茄但没有拆分”的问题。

---

## 日页面定位规则

日页面存储在：

```sql
time_pages.type = 'day'
time_pages.date_key = TARGET_DATE
```

读取：

```sql
SELECT id, type, title, date_key, parent_id, content, created_at, updated_at
FROM time_pages
WHERE type = 'day'
  AND date_key = '<TARGET_DATE>'
LIMIT 1;
```

如果不存在，需要创建时间页面链路：

```text
overview
└── year: YYYY
    └── month: YYYY-MM
        └── week: YYYY-Wxx
            └── day: YYYY-MM-DD
```

创建内容使用项目默认日页面模板：

```md
## 今日记录


## 今日复盘

- 今天完成了什么：
- 哪些没完成：
- 明天要继续：
```

---

## 生成内容格式

追加区块必须使用固定标记，保证可重复执行、可替换、可防重：

```md
<!-- DAILY_AI_REPORT:<TARGET_DATE>:start -->

## AI 时间管理复盘（自动生成｜<生成时间>）

### 1. 今日概览

- 专注总时长：X 小时 Y 分钟
- 有效专注段数：X 段
- 完成任务：X 个
- 原计划未完成：X 个
- 主要投入方向：XXX / XXX / XXX

### 2. 时间投入分布

| 方向 / 分类 | 时长 | 专注段数 | 代表任务 |
|---|---:|---:|---|
| XXX | Xh Ym | X | XXX |

### 3. 任务完成情况

#### 已完成

- ✅ 任务名：预估 X 个番茄，实际 X 个番茄。简短说明。

#### 未完成 / 延期

- ⏳ 任务名：原计划今天，当前未完成。建议明天继续 / 拆小 / 取消。

#### 计划外完成

- ➕ 任务名：不在今日计划中，但今天完成了。说明影响。

### 4. 预估偏差与复盘

- 偏差 1：XXX
- 偏差 2：XXX
- 后续预估修正：XXX

### 5. 明日建议

- 优先继续：XXX
- 需要拆分：XXX
- 需要避免：XXX

<!-- DAILY_AI_REPORT:<TARGET_DATE>:end -->
```

---

## 写入规则

### 1. 禁止覆盖用户手写内容

读取原 `content` 后，只能：

* 如果不存在本日期 AI 区块：追加到全文末尾。
* 如果已存在本日期 AI 区块：替换旧 AI 区块。
* 不允许删除用户原来的「今日记录」「今日复盘」内容。

### 2. 追加位置

优先追加到 `## 今日复盘` 后方。

如果无法稳定定位 `## 今日复盘`，追加到全文末尾。

### 3. 幂等规则

用下面两个标记识别旧区块：

```md
<!-- DAILY_AI_REPORT:<TARGET_DATE>:start -->
<!-- DAILY_AI_REPORT:<TARGET_DATE>:end -->
```

如果两个标记都存在，替换中间整段。

如果只有一个标记存在，停止写入，提示用户日报内容存在异常，避免破坏内容。

---

## 写入前备份

写入 SQLite 前，先备份数据库：

```bash
mkdir -p ../time-butler-data/backups

cp ../time-butler-data/Time-butler.db \
  ../time-butler-data/backups/Time-butler.before-daily-report-<TARGET_DATE>-$(date +"%Y%m%d-%H%M%S").db
```

---

## 写入 SQL

先查到 day page id：

```sql
SELECT id, content
FROM time_pages
WHERE type = 'day'
  AND date_key = '<TARGET_DATE>'
LIMIT 1;
```

然后更新：

```sql
UPDATE time_pages
SET content = '<NEW_CONTENT>',
    updated_at = datetime('now', 'localtime')
WHERE id = <DAY_PAGE_ID>;
```

---

## 写入后验证

必须重新读取确认：

```sql
SELECT id, title, date_key, updated_at, length(content) AS content_length
FROM time_pages
WHERE id = <DAY_PAGE_ID>;
```

还要检查 content 内包含：

```text
DAILY_AI_REPORT:<TARGET_DATE>:start
DAILY_AI_REPORT:<TARGET_DATE>:end
```

---

## 最终回复格式

完成后向用户回复：

```md
已追加到 <TARGET_DATE> 的日报。

- 日页面：<title>
- page id：<id>
- 写入位置：time_pages.content
- 本次统计：专注 X 小时 Y 分钟，完成 X 个任务，未完成 X 个任务
- 查看方式：Time Butler → 时间计划工作台 → 页面树 → <TARGET_DATE>
- 说明：如果 App 已经打开但没刷新，切换页面或重开时间计划工作台即可看到。
```

---

## 禁止事项

* 不要修改 `tasks`、`sessions`、`pomodoro-estimation-log.jsonl`。
* 不要重启 Tauri dev server。
* 不要删除用户原有日报内容。
* 不要把休息段当成专注时长。
* 不要把没有数据支撑的推断写成事实。
* 不要泄露与当天复盘无关的隐私细节。