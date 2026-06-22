# Codex 自然语言加任务流程

本文件由仓库根目录的 `AGENTS.md` 强制引用。Codex 进入本项目后，只要用户要求添加、安排、提醒、预估、拆分或记录任务，都必须先按本流程执行。

Codex 每次帮用户添加任务时，必须遵守下面流程：

1. 读取 `docs/pomodoro-estimation-memo.md`。
2. 解析任务名、项目、优先级、番茄数。
3. 判断是否超过 4 个番茄。
4. 如果超过 4 个番茄，必须建议拆分。
5. 添加任务后，写入 `data/pomodoro-estimation-log.jsonl`。
6. 不要跳过番茄预估。
7. 不要把超过 4 个番茄的大任务静默加入任务清单。

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

任务完成后，如果系统能拿到实际完成番茄数，且实际番茄数比预估番茄数多 1 个以上，需要追加一条 completion 记录，至少包含：

- `completedAt`
- `taskName`
- `estimatedPomos`
- `actualPomos`
- `delta`
- `lesson`

如果同类任务多次低估，需要根据 `data/pomodoro-estimation-log.jsonl` 的偏差记录更新 `docs/pomodoro-estimation-memo.md`。
