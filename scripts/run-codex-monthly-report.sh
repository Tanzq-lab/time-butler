#!/bin/zsh
set -uo pipefail

export HOME="/Users/amos"
export PATH="/Applications/Codex.app/Contents/Resources:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export LANG="zh_CN.UTF-8"
export LC_ALL="zh_CN.UTF-8"
export TZ="Asia/Shanghai"

ROOT="/Users/amos/time-butler"
DATA_DIR="/Users/amos/time-butler-data"
LOG_DIR="$DATA_DIR/logs"
CODEX_CLI="/Applications/Codex.app/Contents/Resources/codex"
STAMP="$(date '+%Y%m%d-%H%M%S')"
RUN_LOG="$LOG_DIR/codex-monthly-report-$STAMP.log"
FINAL_MESSAGE="$LOG_DIR/codex-monthly-report-$STAMP.final.md"
LOCK_DIR="$DATA_DIR/.codex-monthly-report.lock"
TARGET_MONTH="$(date -v1d -v-1m '+%Y-%m')"
MONTH_START="${TARGET_MONTH}-01"
MONTH_END="$(date -v1d -v-1d '+%Y-%m-%d')"

mkdir -p "$LOG_DIR"
exec >>"$RUN_LOG" 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] monthly report job starting"
echo "Target month: $TARGET_MONTH ($MONTH_START to $MONTH_END)"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "Another monthly report job is already running; exiting."
  exit 0
fi

cleanup() {
  rmdir "$LOCK_DIR" 2>/dev/null || true
}
trap cleanup EXIT

if [ ! -x "$CODEX_CLI" ]; then
  echo "Codex CLI not found or not executable: $CODEX_CLI"
  exit 127
fi

cd "$ROOT" || exit 1

PROMPT=$(cat <<PROMPT
在 /Users/amos/time-butler 中执行每月 Time Butler 月报更新。

触发时间为 Asia/Shanghai 每月 1 日 09:30；目标月为运行时所在月份的上一个完整自然月。

本次运行的目标已经由脚本计算完成：
- TARGET_MONTH=$TARGET_MONTH
- MONTH_START=$MONTH_START
- MONTH_END=$MONTH_END

必须先完整读取 /Users/amos/time-butler/复盘/月报SKILL.md，并严格按该 skill 执行：
- 读取 AGENTS.md、README.md、docs/codex-mistake-notebook.md、../time-butler-data/README.md 和 SQLite schema。
- 读取 ../time-butler-data/Time-butler.db 中目标月的 month page、与目标月有交集的 week pages、必要的 day pages、sessions、tasks、categories、week_plan_items、task_activity_log。
- 读取 ../time-butler-data/data/pomodoro-estimation-log.jsonl 中目标月 created/completion 事件。
- 必须阅读相关周页面内容，优先提取 WEEKLY_AI_REPORT:<WEEK_KEY> 区块；没有 AI 周报时读取用户手写周复盘；周页面不足时再读取日页面；不能只按数字汇总。
- 必须扫描目标月日报/周报/月报中的 App 建议关键词，例如 App、Time Butler、时间管家、标签、不直观、优化、建议、刷新、自动，并汇总为系统优化线索。
- 生成 MONTHLY_AI_REPORT:<TARGET_MONTH> 标记包裹的 AI 月复盘。
- 只追加或替换该 AI 区块到 time_pages 中 type='month' 且 date_key='<TARGET_MONTH>' 的页面 content。
- 必要时按 skill 创建缺失 overview/year/month 链路。
- 写入前备份数据库到 ../time-butler-data/backups/Time-butler.before-monthly-report-<TARGET_MONTH>-<timestamp>.db。
- 写入后重新读取验证 start/end 标记、页面 id、标题、updated_at 和 content length。

禁止修改 tasks、sessions、pomodoro-estimation-log.jsonl。
禁止重启 Tauri dev server。
禁止删除用户原有月报内容。
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
echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] monthly report job finished with status $exit_code"
echo "Final message: $FINAL_MESSAGE"
exit "$exit_code"
