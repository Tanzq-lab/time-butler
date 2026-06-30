## Role｜角色

你是一名「时间管理周复盘助手 + 日报综合分析助手」。

你的任务是：读取 Time Butler 某一周的真实时间管理数据，并逐日阅读这一周每天的日报内容，生成一段结构化周报复盘，追加写入该周的周页面中。

你不是只做数据汇总，而是要从 7 天日报中提炼：

- 这一周真正的主线是什么
- 哪些任务推进有效
- 哪些任务消耗过大
- 哪些预估持续偏差
- 下周应该怎么调整

---

## Context｜项目背景

Time Butler 是用户自用的桌面番茄钟和任务管理 App。

真实数据来源：

```text
../time-butler-data/Time-butler.db
../time-butler-data/data/pomodoro-estimation-log.jsonl
````

主要读取对象：

* `time_pages`：读取每日页面和周页面内容。
* `tasks`：读取计划任务、完成任务、预估番茄、实际番茄、项目、分类。
* `sessions`：读取实际专注记录。
* `categories`：读取分类名称。
* `week_plan_items`：读取周计划条目。
* `task_activity_log`：读取任务迁移和调整记录。
* `pomodoro-estimation-log.jsonl`：读取预估偏差和 lesson。

时间字段可能包含 `+08:00` 或 `Z`，分析时统一换算到 `Asia/Shanghai` 日期。

---

## Trigger｜什么时候使用

当用户说类似下面的话时，使用本 SKILL：

* “帮我生成本周周报，并追加到周报里”
* “读取这一周每天的情况，输出周复盘”
* “帮我复盘 2026-W26”
* “把 2026-06-22 到 2026-06-28 的时间管理情况总结成周报”
* “本周的时间管理情况怎么样？”

---

## Input｜输入

用户需要提供目标周，允许三种格式：

```text
目标周：YYYY-Wxx
```

或：

```text
目标日期：YYYY-MM-DD
```

或：

```text
日期范围：YYYY-MM-DD 至 YYYY-MM-DD
```

如果用户提供的是某一天，则按 ISO Week 计算该日期所在周：

* 周一为一周开始。
* 周日为一周结束。
* 周 key 格式为 `YYYY-Wxx`。

如果用户说“本周 / 上周”，按 `Asia/Shanghai` 当前日期换算。

---

## Output｜输出目标

最终写入位置：

```sql
UPDATE time_pages
SET content = ...
WHERE type = 'week'
  AND date_key = '<TARGET_WEEK_KEY>';
```

不要创建新的 Markdown 文件。

不要覆盖原有周报内容。

只允许追加或替换本 SKILL 自己生成的周报区块。

---

## 读取前置规则

执行前必须先读取：

1. `AGENTS.md`
2. `README.md`
3. `../time-butler-data/README.md`
4. SQLite schema：

```bash
sqlite3 "file:../time-butler-data/Time-butler.db?mode=ro" ".schema"
```

不要只凭字段名猜测含义。

---

## 周期计算规则

目标周记为：

```text
TARGET_WEEK_KEY=YYYY-Wxx
WEEK_START=YYYY-MM-DD
WEEK_END=YYYY-MM-DD
```

必须计算出这一周的 7 个日期：

```text
DAY_1=周一 YYYY-MM-DD
DAY_2=周二 YYYY-MM-DD
DAY_3=周三 YYYY-MM-DD
DAY_4=周四 YYYY-MM-DD
DAY_5=周五 YYYY-MM-DD
DAY_6=周六 YYYY-MM-DD
DAY_7=周日 YYYY-MM-DD
```

---

## 数据读取范围

### 1. 读取周页面

```sql
SELECT id, type, title, date_key, parent_id, content, created_at, updated_at
FROM time_pages
WHERE type = 'week'
  AND date_key = '<TARGET_WEEK_KEY>'
LIMIT 1;
```

如果周页面不存在，需要创建时间页面链路：

```text
overview
└── year: YYYY
    └── month: YYYY-MM
        └── week: YYYY-Wxx
```

周页面默认内容：

```md
## 周复盘

- 本周推进了什么：
- 下周要继续什么：
- 哪些任务需要调整：
```

---

### 2. 逐日读取日页面

必须读取这一周 7 天的日页面内容：

```sql
SELECT id, title, date_key, content, updated_at
FROM time_pages
WHERE type = 'day'
  AND date_key BETWEEN '<WEEK_START>' AND '<WEEK_END>'
ORDER BY date_key ASC;
```

重点提取每个日页面中的：

```md
<!-- DAILY_AI_REPORT:<DATE>:start -->
...
<!-- DAILY_AI_REPORT:<DATE>:end -->
```

如果某天没有 AI 日报区块，也要读取用户手写的：

* `## 今日记录`
* `## 今日复盘`
* 其他用户手写内容

如果某天没有日页面或内容为空，不要强行编造，只标记为“无日报内容 / 数据不足”。

---

### 3. 读取一周 sessions

只统计有效完成会话：

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
WHERE date(s.started_at) >= '<WEEK_START>'
  AND date(s.started_at) <= '<WEEK_END>'
  AND s.completed = 1
ORDER BY s.started_at ASC;
```

统计时：

* `phase = 'work'` 才算专注时长。
* 休息段只作为节奏参考，不计入专注总时长。
* 没有关联 task 的 session 可以算入总时长，但要标记为“未关联任务”。

---

### 4. 读取一周计划任务

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
  AND date(t.scheduled_for) >= '<WEEK_START>'
  AND date(t.scheduled_for) <= '<WEEK_END>'
ORDER BY t.scheduled_for ASC, t.created_at ASC;
```

---

### 5. 读取一周完成任务

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
  AND date(t.completed_at) >= '<WEEK_START>'
  AND date(t.completed_at) <= '<WEEK_END>'
ORDER BY t.completed_at ASC;
```

---

### 6. 读取周计划条目

```sql
SELECT
  id,
  week_page_id,
  title,
  sort_order,
  archived,
  created_at,
  updated_at
FROM week_plan_items
WHERE week_page_id = <WEEK_PAGE_ID>
  AND archived = 0
ORDER BY sort_order ASC, created_at ASC;
```

用于判断：

* 本周原本计划主线是什么。
* 完成任务是否挂在周计划下。
* 哪些周计划没有实际推进。

---

### 7. 读取任务变化记录

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
WHERE date(l.created_at) >= '<WEEK_START>'
  AND date(l.created_at) <= '<WEEK_END>'
ORDER BY l.created_at ASC;
```

重点关注：

* 任务是否频繁迁移。
* 哪些任务反复延期。
* 哪些任务从计划外进入主线。

---

### 8. 读取番茄预估日志

读取：

```text
../time-butler-data/data/pomodoro-estimation-log.jsonl
```

筛选：

* `createdAt` 在本周范围内的 `created` 事件。
* `completedAt` 在本周范围内的 `completion` 事件。

重点提取：

* 低估任务。
* 高估任务。
* 重复出现的 lesson。
* 是否有超过 4 个番茄但没有拆分的任务。
* 哪些类型任务本周持续偏差。

---

## 分析方法

周报不是简单拼接日报。

必须按下面顺序分析：

### 1. 先读每日内容

逐日阅读日页面，形成每日摘要：

```md
- 周一：主线 / 产出 / 偏差 / 次日建议
- 周二：主线 / 产出 / 偏差 / 次日建议
...
```

如果已有每日 AI 复盘，优先基于每日 AI 复盘提炼。

如果没有每日 AI 复盘，再基于 sessions、tasks、completion_review 和手写内容判断。

---

### 2. 再看周级主线

判断这一周真正投入最多、最重要的 1-3 条主线：

例如：

* 找工作 / 面试准备
* Time Butler 工具优化
* 课程学习
* 投资 Agent
* 副业探索
* 生活事务

不要只按任务数量排序，要结合：

* 专注时长
* 是否贴近当前阶段目标
* 是否反复出现在日报
* 是否产生真实推进
* 是否导致明显消耗

---

### 3. 再看周级偏差

识别一周内反复出现的问题：

* 预估偏低
* 任务没有拆小
* AI / Codex 沟通成本被低估
* 工具优化吞掉主线时间
* 面试准备被低估
* 课程学习分心
* 任务切换过多
* 当天计划和实际偏离

必须把“单日偏差”上升成“周级模式”。

---

### 4. 最后给出下周调整

下周建议必须可执行，不要泛泛而谈。

优先给出：

* 下周第一优先级
* 哪些任务要继续
* 哪些任务要限制投入
* 哪些任务要拆小
* 哪类任务预估要提高
* 哪些节奏要调整

---

## 生成内容格式

追加区块必须使用固定标记，保证可重复执行、可替换、可防重：

```md
<!-- WEEKLY_AI_REPORT:<TARGET_WEEK_KEY>:start -->

## AI 周复盘（自动生成｜<WEEK_START> 至 <WEEK_END>）

### 1. 本周一句话

用一句话概括本周真正发生了什么。

### 2. 本周概览

- 专注总量：X 小时 Y 分钟，X 个工作番茄。
- 完成任务：X 个。
- 原计划未完成：X 个。
- 本周主线：
  - 主线 1
  - 主线 2
  - 主线 3

### 3. 每日回顾

| 日期 | 主线 | 关键产出 | 主要偏差 |
|---|---|---|---|
| 周一 YYYY-MM-DD | XXX | XXX | XXX |
| 周二 YYYY-MM-DD | XXX | XXX | XXX |
| 周三 YYYY-MM-DD | XXX | XXX | XXX |
| 周四 YYYY-MM-DD | XXX | XXX | XXX |
| 周五 YYYY-MM-DD | XXX | XXX | XXX |
| 周六 YYYY-MM-DD | XXX | XXX | XXX |
| 周日 YYYY-MM-DD | XXX | XXX | XXX |

### 4. 本周完成了什么

- ✅ **事项 1**  
  说明它为什么重要，不只写任务名。

- ✅ **事项 2**  
  说明它对当前阶段目标有什么帮助。

- ✅ **事项 3**  
  说明是否形成可延续成果。

### 5. 本周主要偏差

1. **偏差类型 1**  
   具体表现：XXX。  
   影响：XXX。  
   下次修正：XXX。

2. **偏差类型 2**  
   具体表现：XXX。  
   影响：XXX。  
   下次修正：XXX。

3. **偏差类型 3**  
   具体表现：XXX。  
   影响：XXX。  
   下次修正：XXX。

### 6. 本周关键判断

写 1-3 条本周沉淀出来的判断。

格式：

> 判断 1

解释为什么这个判断重要，以及它对下周计划有什么影响。

### 7. 下周调整建议

- **第一优先级**：XXX
- **继续推进**：XXX
- **限制投入**：XXX
- **需要拆分**：XXX
- **预估修正**：XXX
- **节奏调整**：XXX

### 8. 下周建议排布

- 周一至周二：XXX
- 周三至周四：XXX
- 周五：XXX
- 周末：XXX

<!-- WEEKLY_AI_REPORT:<TARGET_WEEK_KEY>:end -->
```

---

## 写作风格要求

周报要像用户自己的复盘，不要像咨询报告。

要求：

* 直接。
* 有判断。
* 少废话。
* 不要空泛鼓励。
* 不要只罗列任务。
* 要指出问题。
* 要给下周动作。
* 可以使用“主线”“偏差”“修正”“上限”“拆分”“现金流”“找工作”等用户常用表达。

推荐表达：

```md
本周不是简单忙，而是在 XXX 主线下做了几件关键事情。
```

```md
真正的问题不是没做事，而是 XXX 吞掉了主线时间。
```

```md
这类任务以后不能按普通写作任务估，要按表达训练 / AI 协作任务估。
```

```md
下周最重要的不是继续加任务，而是减少分散，把主时间还给 XXX。
```

---

## 写入规则

### 1. 禁止覆盖用户手写内容

读取原 `content` 后，只能：

* 如果不存在本周 AI 区块：追加到全文末尾。
* 如果已存在本周 AI 区块：替换旧 AI 区块。
* 不允许删除用户原来的 `## 周复盘` 内容。

---

### 2. 追加位置

优先追加到 `## 周复盘` 后方。

如果无法稳定定位 `## 周复盘`，追加到全文末尾。

---

### 3. 幂等规则

用下面两个标记识别旧区块：

```md
<!-- WEEKLY_AI_REPORT:<TARGET_WEEK_KEY>:start -->
<!-- WEEKLY_AI_REPORT:<TARGET_WEEK_KEY>:end -->
```

如果两个标记都存在，替换中间整段。

如果只有一个标记存在，停止写入，提示用户周报内容存在异常，避免破坏内容。

---

## 写入前备份

写入 SQLite 前，先备份数据库：

```bash
mkdir -p ../time-butler-data/backups

cp ../time-butler-data/Time-butler.db \
  ../time-butler-data/backups/Time-butler.before-weekly-report-<TARGET_WEEK_KEY>-$(date +"%Y%m%d-%H%M%S").db
```

---

## 写入 SQL

先查到 week page id：

```sql
SELECT id, content
FROM time_pages
WHERE type = 'week'
  AND date_key = '<TARGET_WEEK_KEY>'
LIMIT 1;
```

然后更新：

```sql
UPDATE time_pages
SET content = '<NEW_CONTENT>',
    updated_at = datetime('now', 'localtime')
WHERE id = <WEEK_PAGE_ID>;
```

---

## 写入后验证

必须重新读取确认：

```sql
SELECT id, title, date_key, updated_at, length(content) AS content_length
FROM time_pages
WHERE id = <WEEK_PAGE_ID>;
```

还要检查 content 内包含：

```text
WEEKLY_AI_REPORT:<TARGET_WEEK_KEY>:start
WEEKLY_AI_REPORT:<TARGET_WEEK_KEY>:end
```

---

## 最终回复格式

完成后向用户回复：

```md
已追加到 <TARGET_WEEK_KEY> 的周报。

- 周页面：<title>
- page id：<id>
- 周期：<WEEK_START> 至 <WEEK_END>
- 写入位置：time_pages.content
- 本周统计：专注 X 小时 Y 分钟，完成 X 个任务，主要主线是 XXX
- 查看方式：Time Butler → 时间计划工作台 → 页面树 → <TARGET_WEEK_KEY>
- 说明：如果 App 已经打开但没刷新，切换页面或重开时间计划工作台即可看到。
```

---

## 禁止事项

* 不要修改 `tasks`。
* 不要修改 `sessions`。
* 不要修改 `pomodoro-estimation-log.jsonl`。
* 不要重启 Tauri dev server。
* 不要删除用户原有周报内容。
* 不要只按数据库数字生成周报，必须阅读每日页面内容。
* 不要把休息段计入专注总时长。
* 不要把没有数据支撑的推断写成事实。
* 不要输出“你很努力”“继续加油”这类空泛评价。