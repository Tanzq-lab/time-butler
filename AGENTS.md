# Time Butler Codex Rules

## Product Optimization Methodology Policy

When the user asks Codex to optimize Time Butler as a product/tool, improve UX, add instrumentation, fix workflow friction, or when a report's self-optimization step may change app behavior, Codex must treat AmosTan methodology as required context.

Before changing product behavior, UX, instrumentation, reporting workflow, or optimization rules, Codex must:

1. Read `docs/product-optimization-methodology.md`.
2. Follow its required read order for `/Users/amos/AmosTan`.
3. Read the relevant original methodology notes routed by the problem type.
4. Use local product signals where available: `app_events`, sessions, tasks, completion reviews, time pages, and user feedback.
5. State the user path, extracted need, key assumption, smallest useful change, validation, and risk boundary before or during implementation.

The user delegates product and design judgment to Codex for small, locally verifiable Time Butler improvements. Prefer making a reasonable product decision and implementing it over asking for design direction. Still preserve the safety rules in this file: do not rewrite user data casually, do not restart the Tauri dev server for data-only work, and do not make destructive changes without an explicit request.

## Task Intake Memory Policy

When the user asks Codex to add, schedule, remind, estimate, split, or record a task in this repository, Codex must treat the pomodoro estimation memo as required context.

Before creating or changing any task, Codex must:

1. Read `docs/pomodoro-estimation-memo.md`.
2. Read `docs/codex-task-intake.md`.
3. Read `docs/codex-mistake-notebook.md`.
4. Estimate pomodoros for the task.
5. Separate `project` from `category`: project is the task's product/domain, category is the actual work type.
6. If the estimate is greater than 4 pomodoros, warn the user and suggest subtasks before adding it as one task.
7. After adding a task, append an estimation event to `../time-butler-data/data/pomodoro-estimation-log.jsonl`.

Do not skip pomodoro estimation. Do not silently add tasks estimated above 4 pomodoros as normal tasks.
Do not use broad domains like "工作", "投资", or "个人事务" as categories when a more useful work-type label is available.

## Single App Version

This is a personal-use app. Keep one runtime/data path unless the user explicitly asks otherwise:

- Use the Tauri dev desktop app as the only real app surface.
- Open it only through `open /Users/amos/time-butler/open-time-butler-dev.command`. The launcher owns cleanup and startup; do not launch the runtime by bundle id, app name, or generated `.app` path.
- Never use `open -a Time-butler`, `open -b com.timebutler.desktop`, `src-tauri/target/**/bundle/**/*.app`, a copied `/Applications` app, or Computer Use `get_app_state` as a launcher. macOS LaunchServices can resolve those paths to a stale packaged build.
- If UI control is needed, first verify that port `1420` is listening and the running executable is `target/debug/time-butler`; Computer Use may attach only after that verification and must not launch a missing app.
- Treat `src-tauri/target/**/bundle/` as disposable build output. It is not a supported runtime and may be removed to prevent LaunchServices interference.
- Use `../time-butler-data/Time-butler.db` as the single task database.
- Do not introduce separate dev/prod task databases or browser-preview task data.

## Running App Safety

Assume the user may be actively timing when they ask for task/data updates.

- For pure task/session/category data changes, update the SQLite database and `../time-butler-data/data/pomodoro-estimation-log.jsonl` only.
- Do not edit app source files for a pure data update.
- Do not run commands that restart the dev server for a pure data update.
- If a requested fix requires source/config changes while the app may be open, warn the user that the app can refresh and preserve timer state before proceeding.

## User-Visible Completion

When Codex writes task data outside the UI, completion requires both data persistence and user-visible verification:

- Verify the SQLite row after writing.
- Verify or ensure the task page can reload external database changes.
- Tell the user where to find the task in the UI, such as `进行中`, `稍后提醒`, or `已完成`.
- Include the task id, name, scheduled time, project, and category in the final response.
- If the UI is already open and may hold stale in-memory state, tell the user to refresh or switch away and back.
