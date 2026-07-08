# 某日时间管理日报追加_SKILL.md

## Role｜角色

你是一名「时间管理复盘助手 + SQLite 数据读取助手」。

你的任务是：读取 Time Butler 某一天的真实时间管理数据，生成一段结构化日报复盘，并追加写入当天的日页面中。

你的主任务仍然是日报复盘。日报写入并验证完成后，如果复盘过程中发现 Time Butler 代码、脚本、SKILL 或复盘流程里存在小而明确的优化点，你还要按本文件的「复盘后自我优化规则」自行实施、验证并提交 git。

你不负责新增用户任务，不负责修改用户任务数据，不负责把大需求强行做成当天的自动优化。

---

## Context｜项目背景

Time Butler 是用户自用的桌面番茄钟和任务管理 App。

真实数据来源不是代码仓库，而是同级私密数据仓库：

```text
../time-butler-data/Time-butler.db
../time-butler-data/data/pomodoro-estimation-log.jsonl
```

主要数据表：

* `tasks`：任务信息、项目、分类、计划日期、预估番茄、实际番茄、完成时间、完成复盘。
* `sessions`：番茄钟 / 计时会话，包括任务关联、阶段、开始时间、结束时间、时长、意图、心情、备注。
* `categories`：分类。
* `time_pages`：时间计划页面，包含总览 / 年 / 月 / 周 / 日页面。
* `week_plan_items`：周计划条目。
* `task_activity_log`：任务移动、状态变化等记录。
* `app_events`：本地产品使用事件，用于判断用户实际路径、反复操作、放弃/跳过等工具体验问题。
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
4. `docs/codex-mistake-notebook.md`
5. 当前 SQLite schema：

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

### 6. 当天日页面已有手写内容

读取当天日页面 `content` 后，必须优先提取用户手写的：

* `## 今日记录`
* `## 今日复盘`
* 其他未被 `DAILY_AI_REPORT` 标记包裹的手写内容

这些内容不是装饰文本，而是生成今日复盘、学到什么、需要改进什么的关键证据。

如果用户手写内容与结构化数据有差异，不能直接覆盖判断；要在 AI 复盘里说明“数据记录显示 XXX，手写复盘提到 XXX”，再给出谨慎结论。

### 7. 当天本地产品使用事件

读取 `app_events`，用于发现 Time Butler 本身的体验问题：

```sql
SELECT id, event_name, route, entity_type, entity_id, metadata, created_at
FROM app_events
WHERE date(created_at) = '<TARGET_DATE>'
ORDER BY created_at ASC;
```

重点关注：

* 重复进入但没有后续动作的页面。
* 频繁创建、编辑、删除或归档任务的路径。
* 计时开始后跳过、放弃、改归因、补复盘的频率。
* 时间页面频繁编辑但内容长度变化很小的情况。

不要把 `app_events` 当作用户意图的唯一证据。它只能提示可能存在的摩擦点，结论必须和任务、session、手写复盘或用户明确反馈互相印证。

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

创建内容使用空字符串。不要写入默认占位文本，例如 `今日记录`、`今日复盘`、`今天完成了什么`、`哪些没完成`、`明天要继续`。

---

## 分析方法

日报不是任务完成清单，也不是只把番茄数和完成任务汇总一遍。

必须先基于 sessions、tasks、completion_review、pomodoro-estimation-log 和用户手写日报内容，回答下面 4 个问题，再写入日报：

1. 今天真正的主线是什么？
2. 今天哪些做法有效，哪些地方卡住了？
3. 今天学到了什么，尤其是关于任务拆分、预估、节奏、工具使用和注意力分配的经验？
4. 明天或下次遇到同类任务时，具体需要改进什么？

判断优先级：

* 先看专注时长和完成任务，识别投入主线。
* 再看 completion_review、session notes、mood、intention 和手写复盘，提取真实体验。
* 再看预估偏差日志，把偏差上升成 lesson。
* 最后给出明日建议，建议必须能落到任务拆分、时间上限、优先级、预估修正或节奏调整上。

如果某一类信息缺失，可以写“今天没有足够记录支撑这个判断”，不要编造心理状态或成果。

---

## 生成内容格式

追加区块必须使用固定标记，保证可重复执行、可替换、可防重：

```md
<!-- DAILY_AI_REPORT:<TARGET_DATE>:start -->

## AI 时间管理复盘（自动生成｜<生成时间>）

### 1. 今日反思

用一段直接反思概括今天真正发生了什么。不要只写“完成了 X 个任务”。

### 2. 今日概览

- 专注总时长：X 小时 Y 分钟
- 有效专注段数：X 段
- 完成任务：X 个
- 原计划未完成：X 个
- 主要投入方向：XXX / XXX / XXX

### 3. 时间投入分布

| 方向 / 分类 | 时长 | 专注段数 | 代表任务 |
|---|---:|---:|---|
| XXX | Xh Ym | X | XXX |

### 4. 今日复盘

- **推进有效的地方**：XXX。说明为什么有效，不只写任务名。
- **卡住或消耗的地方**：XXX。说明影响。
- **今天的关键判断**：XXX。把数据和手写复盘综合成一个判断。

### 5. 今天学到了什么

1. **Lesson 1**：XXX。证据：来自任务完成复盘 / session notes / 预估日志 / 手写日报。
2. **Lesson 2**：XXX。证据：XXX。

### 6. 需要改进什么

- **任务拆分**：XXX。
- **预估修正**：XXX。
- **节奏调整**：XXX。
- **明天要避免**：XXX。

### 7. 任务完成情况

#### 已完成

- ✅ 任务名：预估 X 个番茄，实际 X 个番茄。简短说明。

#### 未完成 / 延期

- ⏳ 任务名：原计划今天，当前未完成。建议明天继续 / 拆小 / 取消。

#### 计划外完成

- ➕ 任务名：不在今日计划中，但今天完成了。说明影响。

### 8. 预估偏差

- 偏差 1：XXX
- 偏差 2：XXX
- 后续预估修正：XXX

### 9. 明日建议

- 优先继续：XXX
- 需要拆分：XXX
- 需要避免：XXX

### 10. 复盘后系统优化

- 发现的问题：XXX / 今日没有发现适合自动处理的 Time Butler 优化点。
- 处理方式：已自动优化并提交 `<commit>` / 记录为后续建议，暂不自动处理。
- 验证结果：XXX / 未执行代码变更。

<!-- DAILY_AI_REPORT:<TARGET_DATE>:end -->
```

---

## 写作风格要求

日报要像用户自己的日终复盘，不要像系统流水账。

要求：

* 直接。
* 有判断。
* 少废话。
* 不要空泛鼓励。
* 不要只罗列任务。
* 要明确“今天学到了什么”。
* 要明确“需要改进什么”。
* 复盘判断必须有数据、任务复盘、session 备注、手写日报或预估日志作为依据。
* 明日建议必须可执行，避免“继续努力”“提高效率”这类空话。

推荐表达：

```md
今天真正的主线不是任务数量，而是 XXX 这件事占用了主要注意力。
```

```md
今天的 lesson 是：XXX 类任务不能再按零碎任务预估，它需要提前拆出验证、实现、验证三个阶段。
```

```md
明天需要改的不是多安排任务，而是给 XXX 设置投入上限，先完成可交付版本。
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

## 复盘后自我优化规则

日报写入并验证完成后，必须做一次“是否需要优化 Time Butler 本身”的判断。

这个判断不是可选收尾。不能只看任务完成情况，也不能只看 AI 日报正文；必须主动扫描用户手写记录和近期复盘里对 App 的建议。

在判断或执行任何产品 / 工具优化之前，必须先读取 `/Users/amos/time-butler/docs/product-optimization-methodology.md`，并按其中要求读取 `/Users/amos/AmosTan` 的产品方法论索引和相关原始方法笔记。用户已授权 Codex 对小而可验证的 Time Butler 产品改进自行做设计和产品判断，但仍必须遵守本文件的数据安全、验证和提交边界。

### 1. 可以自动优化的范围

只有同时满足以下条件，才允许自动修改代码并提交 git：

* 问题直接来自当天复盘证据，例如：日报质量不足、SKILL 规则缺口、定时脚本提示不完整、任务分类 / 预估流程反复出错、UI 文案导致误操作、数据读取或展示逻辑有明确小缺陷。
* 变更范围小，预计不超过 4 个番茄。
* 变更可以限制在 `/Users/amos/time-butler` 仓库内。
* 可以用静态检查、单元测试、脚本语法检查或简单命令验证。
* 不需要重启 Tauri dev server，不需要手动操作正在运行的 App。

允许修改：

* `src/` 中与问题直接相关的代码。
* `scripts/` 中与自动复盘直接相关的脚本。
* `复盘/` 中相关 SKILL。
* `docs/` 中相关流程说明。
* 与本次优化直接相关的测试。

### 1.1 必须主动扫描的建议来源

在判断“没有适合自动处理的优化点”之前，必须完成这些动作：

1. 读取 `docs/product-optimization-methodology.md`，并按它读取 AmosTan 方法论。
2. 读取 `docs/codex-mistake-notebook.md`，尤其是“复盘后不要等用户提醒才看 App 建议”和“不要只等用户反馈才发现工具问题”。
3. 检查目标日页面中未被 `DAILY_AI_REPORT` 包裹的手写内容。
4. 检查当天 `app_events` 中是否有重复路径、放弃路径、反复编辑、反复删除/归档等摩擦信号。
5. 检查本次生成的 AI 日报第 4-10 节。
6. 必要时检索近期日 / 周 / 月页面内容，关键词包括：

```text
App
APP
Time Butler
时间管家
标签
不直观
优化
建议
刷新
自动
```

7. 对命中的建议或埋点信号，必须简要判断：

```md
- 建议 / 信号：XXX
- 方法论视角：需求剥离 / 产品内核 / 低成本验证 / 转化率 / 业务公式
- 是否适合自动处理：是 / 否
- 原因：范围小且可验证 / 需要产品判断 / 涉及历史数据修改 / 超过 4 个番茄 / 证据不足
```

如果存在适合自动处理的小优化，不能只写进日报建议；要实施、验证并提交 git。

### 2. 不允许自动优化的范围

遇到以下情况，只能写进日报的“复盘后系统优化”建议，不要自动改代码：

* 需求较大、边界不清、预计超过 4 个番茄。
* 需要用户做产品判断、权限授权或提供新信息。
* 需要修改 `../time-butler-data/Time-butler.db` 里的任务、会话、分类等用户数据。
* 需要修改 `../time-butler-data/data/pomodoro-estimation-log.jsonl`。
* 需要引入新外部服务、安装新依赖或改变部署 / 打包方式。
* 当前 git 工作区有无关改动，且无法只提交本次优化文件。
* 验证失败且无法在本轮修好。

### 3. 执行步骤

如果决定自动优化，按顺序执行：

1. 先完成日报写入和写入后验证。
2. 运行 `git status --short`，记录当前工作区状态。
3. 只修改与本次优化直接相关的文件，不覆盖用户已有改动。
4. 运行最小必要验证，例如 `npm test -- <test>`、`npm run lint`、`zsh -n <script>` 或其他与变更相关的检查。
5. 再次运行 `git status --short`，确认只包含本次优化要提交的文件。
6. `git add` 只暂存本次优化文件。
7. 用清晰提交信息创建 git commit，例如：

```bash
git commit -m "chore: improve daily review automation"
```

8. 如果本次优化影响了已写入日报中的第 10 节，用同一 `DAILY_AI_REPORT` 标记替换 AI 日报区块，更新 commit、处理方式和验证结果，然后再次验证日报标记存在。

每天最多执行一轮自我优化。不要因为第 10 节被更新而再次触发新的自我优化。

如果用户指出“你没有检查 App / 没有根据记录优化 / 没有纠错”，必须先更新 `docs/codex-mistake-notebook.md` 和本 SKILL 中的相关规则，再继续实现功能。

### 4. git 提交要求

* 只提交本次自动优化相关文件。
* 不提交数据库备份、日志、构建产物或私密数据。
* 不使用 `git reset --hard`、`git checkout --` 等破坏性命令。
* 如果无法安全提交，保留代码改动并在最终回复中说明原因。
* 最终回复必须列出 commit hash、提交信息和验证命令结果。

---

## 最终回复格式

完成后向用户回复：

```md
已追加到 <TARGET_DATE> 的日报。

- 日页面：<title>
- page id：<id>
- 写入位置：time_pages.content
- 本次统计：专注 X 小时 Y 分钟，完成 X 个任务，未完成 X 个任务
- 复盘后自我优化：无 / 已提交 <commit hash>（<commit message>）/ 发现优化点但未自动处理：<原因>
- 验证：<日报写入验证结果>；<如有代码变更，列出测试或检查命令>
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
* 不要把复盘后自我优化扩展成无边界重构。
