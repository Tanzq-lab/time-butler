# Time Butler Codex Rules

## Task Intake Memory Policy

When the user asks Codex to add, schedule, remind, estimate, split, or record a task in this repository, Codex must treat the pomodoro estimation memo as required context.

Before creating or changing any task, Codex must:

1. Read `docs/pomodoro-estimation-memo.md`.
2. Read `docs/codex-task-intake.md`.
3. Estimate pomodoros for the task.
4. If the estimate is greater than 4 pomodoros, warn the user and suggest subtasks before adding it as one task.
5. After adding a task, append an estimation event to `data/pomodoro-estimation-log.jsonl`.

Do not skip pomodoro estimation. Do not silently add tasks estimated above 4 pomodoros as normal tasks.

## Single App Version

This is a personal-use app. Keep one runtime/data path unless the user explicitly asks otherwise:

- Use the Tauri desktop app as the only real app surface.
- Use `sqlite:Kairos-Pomodoro.db` as the single task database.
- Do not introduce separate dev/prod task databases or browser-preview task data.
