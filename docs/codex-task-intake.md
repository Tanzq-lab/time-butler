# Codex 自然语言加任务流程

本文件由仓库根目录的 `AGENTS.md` 强制引用。Codex 进入本项目后，只要用户要求添加、安排、提醒、预估、拆分或记录任务，都必须先按本流程执行。

Codex 每次帮用户添加任务时，必须遵守下面流程：

1. 读取 `docs/pomodoro-estimation-memo.md`。
2. 读取 `docs/codex-mistake-notebook.md`。
3. 解析任务名、项目、优先级、分类、番茄数。
4. 判断是否超过 4 个番茄。
5. 如果超过 4 个番茄，必须建议拆分。
6. 添加任务后，写入 `../time-butler-data/data/pomodoro-estimation-log.jsonl`。
7. 不要跳过番茄预估。
8. 不要把超过 4 个番茄的大任务静默加入任务清单。
9. 如果任务由 Codex 直接写入 SQLite，还必须确认 UI 可见性或说明刷新方式。

## 项目与分类规则

为了让复盘更直观，Codex 添加或补录任务时必须区分：

- `project`：任务属于哪个产品、领域或长期事项，例如 `时间管家`、`投资Agent`、`个人事务`。
- `category`：这段番茄实际在做什么类型的工作，例如 `项目初始化`、`功能优化`、`Bug修复`、`测试验证`、`工作流优化`、`行政办理`、`Codex协作`。

不要默认把 `工作`、`投资`、`个人事务` 这类大领域写进分类。它们更适合放在 `project`。如果分类过粗，应根据任务动作细化为工作类型。

## 超过 4 个番茄的处理

当自然语言解析器预估某个任务需要超过 4 个番茄时，不要直接作为普通任务加入任务清单。必须先生成任务草稿，标记 `needsBreakdown: true`，给出拆分建议，并提醒用户：

> 这个任务预计超过 4 个番茄，建议拆分。

用户确认后才可以添加原任务；否则应引导用户按建议拆成多个子任务。

## 日志要求

通过 Codex 或 App 快速输入框添加任务时，需要追加一条 created 记录，至少包含：

- `createdAt`
- `taskName`
- `project`
- `category`
- `estimatedPomos`
- `confidence`
- `reason`
- `needsBreakdown`

任务完成后，如果系统能拿到实际完成番茄数，且实际番茄数和预估番茄数相差 1 个以上，不管是提前完成还是超时完成，都需要追加一条 completion 记录，至少包含：

- `completedAt`
- `taskName`
- `estimatedPomos`
- `actualPomos`
- `delta`
- `lesson`

如果同类任务多次低估，需要根据 `../time-butler-data/data/pomodoro-estimation-log.jsonl` 的偏差记录更新 `docs/pomodoro-estimation-memo.md`。

## UI 可见性验收

当 Codex 不通过 UI 表单，而是直接写入 `../time-butler-data/Kairos-Pomodoro.db` 时，必须在最终回复前完成：

1. 查询 SQLite，确认任务行存在且未归档。
2. 判断任务属于 `进行中`、`稍后提醒` 还是 `已完成`。
3. 如果前端已经打开，确认任务页会重新加载任务；若无法确认，明确提示用户刷新窗口或切出再切回。
4. 最终回复写明任务 ID、任务名、时间、项目、分类和 UI 分区。
