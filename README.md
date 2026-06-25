# 时间管家

时间管家是一个个人自用的桌面番茄钟和任务管理 App。它现在只保留一个真实使用版本：Tauri 桌面版，使用同一个 SQLite 数据库，不再维护浏览器预览版、开发库和正式库三套数据。

## 快速启动

双击或运行：

```zsh
/Users/amos/time-butler/open-kairos-dev.command
```

这是日常使用入口。它运行的是 Tauri 开发热更新版，所以 Codex 改前端代码后通常可以立即刷新生效；改 Rust/Tauri 壳层能力时，重新打开这个脚本即可。

启动脚本会：

- 使用 npm 安装缺失依赖。
- 检查 Rust / cargo 是否可用。
- 停掉 1420 端口上残留的旧本地服务。
- 启动 Tauri 开发热更新版。

这个项目不把打包出来的 `.app` 当作日常使用版本。命令行窗口是开发热更新版的运行器和日志窗口，属于预期行为。

如果提示没有 Rust / cargo，先安装 Rust：

```zsh
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

## 核心功能

- 番茄钟：专注、短休息、长休息、超时计时。
- 任务管理：任务、项目、优先级、分类、完成番茄数。
- 稍后提醒：未来任务会显示在「稍后提醒」分区，到时间后进入普通任务流。
- 通知和音效：计时结束会发送系统通知；如果设置里开启声音提醒，会播放提示音。
- 分析统计：专注记录、分类统计、日历和导出。
- Codex 自然语言加任务：本地规则解析任务、估算番茄数、超过 4 个番茄时建议拆分。

## 一个版本原则

这个项目是个人自用工具，优先减少环境分叉。

- App surface：只使用 Tauri 桌面版。
- 数据库：只使用同级私密仓库里的 `../time-butler-data/Kairos-Pomodoro.db`。
- 启动入口：只使用 `open-kairos-dev.command` 或 `npm run tauri dev`。
- 日常使用：使用开发热更新版，不维护本机安装的固定 `.app` 版本。
- 不再把浏览器预览版当真实 App 使用。
- 不再引入 `Kairos-Pomodoro-dev.db` 这类第二套任务数据。

真实数据库位于：

```text
../time-butler-data/Kairos-Pomodoro.db
```

## 私密数据仓库

本仓库只放应用代码。个人数据默认同步到同级目录：

```text
../time-butler-data
```

也就是本机上的：

```text
/Users/amos/time-butler-data
```

初始化私密数据目录：

```zsh
npm run data:init
```

如果 `../time-butler-data` 不存在，这条命令会创建它，并创建 `data/` 和 `backups/` 子目录。

确认私密数据仓库可用，并合并本仓库里遗留的估算日志：

```zsh
npm run data:backup
```

App 现在直接读写 `../time-butler-data/Kairos-Pomodoro.db`。如果本仓库临时产生了 `data/pomodoro-estimation-log.jsonl`，脚本会去重合并到私密仓库后删除本仓库里的临时日志。

## Codex 加任务规则

Codex 帮忙添加、安排、提醒、预估、拆分或记录任务时，必须先读项目记忆：

1. `AGENTS.md`
2. `docs/pomodoro-estimation-memo.md`
3. `docs/codex-task-intake.md`

必须遵守：

- 不跳过番茄预估。
- 预计超过 4 个番茄时，先提醒拆分，不静默加入普通任务清单。
- 添加任务后，追加记录到 `../time-butler-data/data/pomodoro-estimation-log.jsonl`。
- 任务完成后，如果实际番茄数比预估多 1 个以上，追加偏差记录。

相关文件：

- `AGENTS.md`：Codex 进入本仓库时必须遵守的项目级规则。
- `docs/pomodoro-estimation-memo.md`：番茄预估经验库。
- `docs/codex-task-intake.md`：自然语言加任务流程。
- `../time-butler-data/data/pomodoro-estimation-log.jsonl`：私密仓库里的预估和偏差日志。

## 常用命令

安装依赖：

```zsh
npm install
```

启动开发热更新版：

```zsh
npm run tauri dev
```

运行测试：

```zsh
npm test
```

构建前端：

```zsh
npm run build
```

检查 Tauri/Rust：

```zsh
cd src-tauri
cargo check
```

## 目录说明

```text
src/                         React 前端
src/features/timer/           计时器状态和专注流程
src/features/tasks/           任务 store、自然语言解析、预估日志
src/lib/db/                   SQLite schema 和数据访问
src-tauri/                    Tauri 桌面壳和 Rust commands
docs/                         Codex 任务录入和番茄预估文档
data/                         仅保留占位；运行日志写入 ../time-butler-data/data/
scripts/private-data.mjs      同级私密数据仓库初始化和遗留日志合并脚本
open-kairos-dev.command       日常开发热更新启动入口
AGENTS.md                     Codex 项目规则入口
```

## 排障

### 看不到刚添加的任务

先确认打开的是桌面版，不是浏览器预览。现在推荐只运行：

```zsh
/Users/amos/time-butler/open-kairos-dev.command
```

再确认任务是否在稍后提醒分区。未来任务不会出现在「进行中」分区。

### 端口 1420 被占用

启动脚本会自动停止 1420 上残留的旧本地服务。如果仍然异常，可以手动查看：

```zsh
lsof -nP -iTCP:1420 -sTCP:LISTEN
```

### 没有声音

检查 App 设置里的「声音提醒」是否开启。计时结束的音效由浏览器 AudioContext 播放，第一次播放可能需要 App 窗口已经有过用户交互。

### 通知没有弹出

检查 macOS 系统设置里的通知权限，允许时间管家发送通知。

## 维护原则

- 优先保持一个真实版本和一个数据库。
- 改任务录入逻辑时，同步更新 `docs/codex-task-intake.md` 和相关测试。
- 改番茄预估规则时，同步更新 `docs/pomodoro-estimation-memo.md`。
- 改数据库 schema 时，增加版本化 migration，并确认旧数据可继续读取。
- 完成重要改动后至少运行 `npm test`、`npm run build` 和 `cargo check`。
