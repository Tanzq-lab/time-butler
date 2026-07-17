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
RUN_LOG="$LOG_DIR/codex-daily-report-$STAMP.log"
FINAL_MESSAGE="$LOG_DIR/codex-daily-report-$STAMP.final.md"
LOCK_DIR="$DATA_DIR/.codex-daily-report.lock"
TARGET_DATE="${TIME_BUTLER_REPORT_DATE:-$(date -v-1d '+%Y-%m-%d')}"

mkdir -p "$LOG_DIR"
exec >>"$RUN_LOG" 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] daily report job starting"
echo "Target date: $TARGET_DATE"

parsed_target_date="$(date -j -f '%Y-%m-%d' "$TARGET_DATE" '+%Y-%m-%d' 2>/dev/null)"
if [ "$parsed_target_date" != "$TARGET_DATE" ]; then
  echo "Invalid target date: $TARGET_DATE (expected YYYY-MM-DD)"
  exit 64
fi

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "Another daily report job is already running; exiting."
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

PRODUCT_INSIGHT_DIR="$DATA_DIR/data/product-insights"
PRODUCT_INSIGHT_MARKDOWN="$PRODUCT_INSIGHT_DIR/$TARGET_DATE.md"
PRODUCT_INSIGHT_JSON="$PRODUCT_INSIGHT_DIR/$TARGET_DATE.json"

if node "$ROOT/scripts/analyze-daily-product-usage.mjs" --date "$TARGET_DATE"; then
  echo "Daily product usage analysis ready: $PRODUCT_INSIGHT_MARKDOWN"
else
  analysis_exit_code=$?
  echo "Daily product usage analysis failed with status $analysis_exit_code; Codex must report the gap and may inspect app_events directly."
fi

PROMPT=$(cat <<PROMPT
在 /Users/amos/time-butler 中执行每日 Time Butler 日报更新。

本次运行的目标日期已经由脚本按 Asia/Shanghai 计算完成：
- TARGET_DATE=$TARGET_DATE

必须先完整读取 /Users/amos/time-butler/复盘/日报SKILL.md，并严格按该 skill 执行：
- 读取 AGENTS.md、README.md、docs/codex-mistake-notebook.md、../time-butler-data/README.md 和 SQLite schema。
- 从 ../time-butler-data/Time-butler.db 与 ../time-butler-data/data/pomodoro-estimation-log.jsonl 读取 TARGET_DATE=$TARGET_DATE 的数据，包括 sessions、tasks、completion_review、time_pages、task_activity_log 和 app_events。
- 读取本次预先生成的本地产品路径分析 $PRODUCT_INSIGHT_MARKDOWN 与 $PRODUCT_INSIGHT_JSON；如果文件缺失或分析失败，运行 node scripts/analyze-daily-product-usage.mjs --date $TARGET_DATE 后再继续。
- 按 skill 的“AI知识库项目的 Git 收尾与目标日提交”规则执行：用 Finder 的“AI知识库”标签动态发现目录，不得硬编码当前项目清单；逐仓库理解现有修改、按独立意图和明确路径安全拆分本地 commit，并运行最小验证。不得推送远端，不得提交凭据、数据库、备份、日志、构建产物或其他私密运行数据；冲突、历史改写状态、验证失败或归属不清时跳过并报告。
- 读取所有发现仓库在 Asia/Shanghai 的 TARGET_DATE=$TARGET_DATE 时间窗内的本地分支提交；不能只看提交标题，必须检查 commit stat，必要时检查 diff，再按仓库和工作主题归纳具体完成内容。本次运行今天新建的收尾 commit 不得倒填到目标日日报。
- 路径分析必须检查 App 使用会话覆盖率、常见路径、页面有效停留、前后台切换、计时/任务关键动作和通知音频诊断；用 sessions、tasks、completion_review、时间页手写反馈等本地信号交叉验证，不能只凭单一埋点推断用户心理。
- 生成 DAILY_AI_REPORT:$TARGET_DATE 标记包裹的紧凑日报整理区块。
- 必须单独生成“任务完成记录（原文）”：只收集 completed_at 按 Asia/Shanghai 归属于 TARGET_DATE=$TARGET_DATE 且非空的每一条 completion_review，按完成时间排列。
- completion_review 只汇总一次，必须保持原文和换行，不摘要、不改写、不纠错、不合并。不得因任务当天有 session、当天被计划或后来才完成，就把其他日期的完成复盘混入。
- 目标日日页面中用户自己写的日报必须完整阅读和理解，但它已存在于页面中，不得在自动区块中再次摘要、改写或大段复述。
- AI 部分只允许写 1 个高价值关键判断和最多 3 条下一步行动。每条行动必须包含范围或时间上限和完成标准；证据不足时明确写数据不足，不要编造或填满章节。
- 当日时长和番茄只能从目标日 work sessions 计算；不得把任务累计 completed_pomos 写成当日投入。
- 日报写入并验证完成后，必须按 skill 的「复盘后自我优化规则」判断 Time Butler 代码、脚本、SKILL 或复盘流程是否有小而明确的优化点。
- 判断或执行任何 Time Butler 产品 / 工具优化前，必须先读取 docs/product-optimization-methodology.md，并按它读取 /Users/amos/AmosTan 的产品方法论索引和相关原始方法笔记。
- 判断复盘后自我优化时，必须主动扫描目标日页面手写内容和近期日/周/月页面中的 App 建议关键词，例如 App、Time Butler、时间管家、标签、不直观、优化、建议、刷新、自动。
- 自动任务最终结果必须单列“产品路径分析”：最多提出 3 条建议，每条都写清用户路径、提炼需求、关键假设、最小有用变化、验证方式和风险边界；证据只有单日或埋点覆盖不足时只标记观察，不为填满建议而制造优化项。产品建议和工程审计不得写入个人日报 AI 区块。
- 如果优化点预计不超过 4 个番茄、能限制在 /Users/amos/time-butler 仓库内、能安全验证，允许自行修改相关文件、运行最小必要验证、只暂存本次优化文件并创建 git commit。
- 如果问题较大、边界不清、工作区有无法隔离的无关改动、验证失败、需要用户判断、或需要修改用户任务数据，只写入本次自动任务的最终结果和日志，不要把内部工程审计写入个人日报，也不要自动提交。
- 只追加或替换该 AI 区块到 time_pages 中 type='day' 且 date_key='$TARGET_DATE' 的页面 content。
- 必要时按 skill 创建缺失 day 页面链路。
- 写入前备份数据库到 ../time-butler-data/backups。
- 写入后重新读取验证 start/end 标记、页面 id、标题、updated_at 和 content length。
- 最终结果必须列出动态发现的 Git 仓库、每个新建 commit 的仓库/hash/提交信息/验证结果、跳过项及原因，以及目标日 Git 复盘覆盖的仓库数与 commit 数。

禁止修改 tasks、sessions、pomodoro-estimation-log.jsonl。
禁止重启 Tauri dev server。
禁止提交数据库备份、日志、构建产物或私密数据。
禁止执行 git push、改写历史、强制操作，或为了凑提交而修改其他项目。
禁止删除用户原有日报内容。
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
echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] daily report job finished with status $exit_code"
echo "Final message: $FINAL_MESSAGE"
exit "$exit_code"
