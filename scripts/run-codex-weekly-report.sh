#!/bin/zsh
set -uo pipefail

export HOME="/Users/amos"
export PATH="/Applications/Codex.app/Contents/Resources:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export LANG="zh_CN.UTF-8"
export LC_ALL="zh_CN.UTF-8"

ROOT="/Users/amos/time-butler"
DATA_DIR="/Users/amos/time-butler-data"
LOG_DIR="$DATA_DIR/logs"
CODEX_CLI="/Applications/Codex.app/Contents/Resources/codex"
STAMP="$(date '+%Y%m%d-%H%M%S')"
RUN_LOG="$LOG_DIR/codex-weekly-report-$STAMP.log"
FINAL_MESSAGE="$LOG_DIR/codex-weekly-report-$STAMP.final.md"
LOCK_DIR="$DATA_DIR/.codex-weekly-report.lock"

mkdir -p "$LOG_DIR"
exec >>"$RUN_LOG" 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] weekly report job starting"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "Another weekly report job is already running; exiting."
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

PROMPT=$(cat <<'PROMPT'
在 /Users/amos/time-butler 中执行每周 Time Butler 周报更新。

触发时间为 Asia/Shanghai 每周一 09:30；目标周为运行时所在 ISO 周的上一个完整 ISO 周，周一开始、周日结束。计算 TARGET_WEEK_KEY=YYYY-Wxx、WEEK_START=YYYY-MM-DD、WEEK_END=YYYY-MM-DD。

必须先完整读取 /Users/amos/time-butler/复盘/周报SKILL.md，并严格按该 skill 执行：
- 读取 AGENTS.md、README.md、../time-butler-data/README.md 和 SQLite schema。
- 读取 ../time-butler-data/Time-butler.db 中目标周的 week page、7 天 day pages、sessions、tasks、categories、week_plan_items、task_activity_log。
- 读取 ../time-butler-data/data/pomodoro-estimation-log.jsonl 中目标周 created/completion 事件。
- 必须逐日阅读日报内容，优先提取 DAILY_AI_REPORT:<DATE> 区块；没有 AI 日报时读取用户手写内容；不能只按数字汇总。
- 生成 WEEKLY_AI_REPORT:<TARGET_WEEK_KEY> 标记包裹的 AI 周复盘。
- 只追加或替换该 AI 区块到 time_pages 中 type='week' 且 date_key='<TARGET_WEEK_KEY>' 的页面 content。
- 必要时按 skill 创建缺失 overview/year/month/week 链路。
- 写入前备份数据库到 ../time-butler-data/backups/Time-butler.before-weekly-report-<TARGET_WEEK_KEY>-<timestamp>.db。
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
