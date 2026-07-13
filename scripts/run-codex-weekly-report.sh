#!/bin/zsh
set -uo pipefail

export HOME="/Users/amos"
export PATH="/Applications/ChatGPT.app/Contents/Resources:/Applications/Codex.app/Contents/Resources:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export LANG="zh_CN.UTF-8"
export LC_ALL="zh_CN.UTF-8"
export TZ="Asia/Shanghai"

ROOT="/Users/amos/time-butler"
DATA_DIR="/Users/amos/time-butler-data"
LOG_DIR="$DATA_DIR/logs"
CODEX_CLI="${CODEX_CLI:-}"
STAMP="$(date '+%Y%m%d-%H%M%S')"
RUN_LOG="$LOG_DIR/codex-weekly-report-$STAMP.log"
FINAL_MESSAGE="$LOG_DIR/codex-weekly-report-$STAMP.final.md"
LOCK_DIR="$DATA_DIR/.codex-weekly-report.lock"
TARGET_WEEK_KEY="$(date -v-7d '+%G-W%V')"
WEEK_START="$(date -v-7d -vmon '+%Y-%m-%d')"
WEEK_END="$(date -v-7d -vmon -v+6d '+%Y-%m-%d')"
PREVIOUS_WEEK_KEY="$(date -v-14d '+%G-W%V')"
PREVIOUS_WEEK_START="$(date -v-14d -vmon '+%Y-%m-%d')"
PREVIOUS_WEEK_END="$(date -v-14d -vmon -v+6d '+%Y-%m-%d')"

mkdir -p "$LOG_DIR"
exec >>"$RUN_LOG" 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] weekly report job starting"
echo "Target week: $TARGET_WEEK_KEY ($WEEK_START to $WEEK_END)"
echo "Previous week: $PREVIOUS_WEEK_KEY ($PREVIOUS_WEEK_START to $PREVIOUS_WEEK_END)"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "Another weekly report job is already running; exiting."
  exit 0
fi

cleanup() {
  rmdir "$LOCK_DIR" 2>/dev/null || true
}
trap cleanup EXIT

if [ -z "$CODEX_CLI" ]; then
  path_codex="$(command -v codex 2>/dev/null || true)"
  for candidate in \
    "/Applications/ChatGPT.app/Contents/Resources/codex" \
    "/Applications/Codex.app/Contents/Resources/codex" \
    "$path_codex"
  do
    if [ -n "$candidate" ] && [ -x "$candidate" ]; then
      CODEX_CLI="$candidate"
      break
    fi
  done
fi

if [ -z "$CODEX_CLI" ] || [ ! -x "$CODEX_CLI" ]; then
  echo "Codex CLI not found or not executable. Checked ChatGPT.app, Codex.app, and PATH."
  exit 127
fi

echo "Codex CLI: $CODEX_CLI"

cd "$ROOT" || exit 1

PROMPT=$(cat <<PROMPT
在 /Users/amos/time-butler 中执行每周 Time Butler 周报更新。

触发时间为 Asia/Shanghai 每周一 09:30。

本次运行的目标已经由脚本按 Asia/Shanghai 计算完成：
- TARGET_WEEK_KEY=$TARGET_WEEK_KEY
- WEEK_START=$WEEK_START
- WEEK_END=$WEEK_END
- PREVIOUS_WEEK_KEY=$PREVIOUS_WEEK_KEY
- PREVIOUS_WEEK_START=$PREVIOUS_WEEK_START
- PREVIOUS_WEEK_END=$PREVIOUS_WEEK_END

必须先完整读取 /Users/amos/time-butler/复盘/周报SKILL.md，并严格按该 skill 执行：
- 读取 AGENTS.md、README.md、docs/codex-mistake-notebook.md、../time-butler-data/README.md 和 SQLite schema。
- 读取 ../time-butler-data/Time-butler.db 中 $TARGET_WEEK_KEY（$WEEK_START 至 $WEEK_END）的 week page、7 天 day pages、sessions、tasks、categories、week_plan_items、task_activity_log。
- 若 $PREVIOUS_WEEK_KEY（$PREVIOUS_WEEK_START 至 $PREVIOUS_WEEK_END）存在完整数据，按与本周完全相同口径读取其 week page、sessions、完成任务和周计划，用于“与上周相比”；必须同时展示绝对值与变化量，且不得把不同周的手写周承诺混为完成率。
- 读取 ../time-butler-data/data/pomodoro-estimation-log.jsonl 中 $TARGET_WEEK_KEY（$WEEK_START 至 $WEEK_END）的 created/completion 事件。
- 必须逐日阅读日报内容，优先提取 DAILY_AI_REPORT:<DATE> 区块；没有 AI 日报时读取用户手写内容；不能只按数字汇总。
- 必须扫描本周日报/周报中的 App 建议关键词，例如 App、Time Butler、时间管家、标签、不直观、优化、建议、刷新、自动；在最终结果中汇总系统优化线索及其处理边界，但不要把工程审计写入个人周报 AI 区块。
- 必须把用户的个人输出定义为本周所有非空任务完成复盘，以及每个日页面中 DAILY_AI_REPORT 标记之外的手写内容。写入前先建立覆盖清单，确保每条原始文字都归入一个主题或“零散记录”；周报中按 2–5 个主题汇总并标注日期/任务来源，不逐条复制，也不得把任务标题、番茄数或 AI 日报伪装成用户输出。
- 周报必须遵守 SKILL 的质量门禁：只保留一个有证据和边界的周级判断、最多两项带上限/完成标准/验证记录的下周实验；不得重写逐日流水账、混淆周承诺和排期任务，或在未读取并引用下周计划时虚构日期排布。
- 生成 WEEKLY_AI_REPORT:$TARGET_WEEK_KEY 标记包裹的 AI 周复盘。
- 只追加或替换该 AI 区块到 time_pages 中 type='week' 且 date_key='$TARGET_WEEK_KEY' 的页面 content。
- 必要时按 skill 创建缺失 overview/year/month/week 链路。
- 写入前备份数据库到 ../time-butler-data/backups/Time-butler.before-weekly-report-$TARGET_WEEK_KEY-<timestamp>.db。
- 写入后重新读取验证 start/end 标记、页面 id、标题、updated_at 和 content length。

禁止修改 tasks、sessions、pomodoro-estimation-log.jsonl。
禁止重启 Tauri dev server。
禁止删除用户原有周报内容。
如果 marker 不完整、数据库不可写、或写入后疑似被打开中的 App 旧缓存覆盖，停止并在最终结果中明确报告。
PROMPT
)

"$CODEX_CLI" exec \
  -C "$ROOT" \
  --dangerously-bypass-approvals-and-sandbox \
  -c 'model_reasoning_effort="medium"' \
  --output-last-message "$FINAL_MESSAGE" \
  "$PROMPT"

exit_code=$?
echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] weekly report job finished with status $exit_code"
echo "Final message: $FINAL_MESSAGE"
exit "$exit_code"
