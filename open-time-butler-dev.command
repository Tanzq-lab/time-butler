#!/bin/zsh

set -u

cd -- "$(dirname "$0")" || exit 1

export PATH="${HOME}/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:${PATH}"

PORT=1420
LOG_DIR="${HOME}/Library/Logs/Time Butler"
LOG_FILE="${LOG_DIR}/time-butler-dev.log"
TERMINAL_TITLE="Time Butler Launcher"

printf '\033]0;%s\007' "${TERMINAL_TITLE}"

has_command() {
  command -v "$1" >/dev/null 2>&1
}

port_is_listening() {
  lsof -nP -iTCP:"${PORT}" -sTCP:LISTEN >/dev/null 2>&1
}

stop_existing_frontend() {
  local listener_pids
  listener_pids="$(lsof -tiTCP:"${PORT}" -sTCP:LISTEN 2>/dev/null || true)"

  if [ -n "${listener_pids}" ]; then
    echo "检测到 ${PORT} 端口已有本地服务，先停止它。"
    kill ${listener_pids} >/dev/null 2>&1 || true
    sleep 1
  fi
}

install_with_npm_if_needed() {
  if ! has_command npm; then
    echo "没有找到 npm。请先安装 Node.js："
    echo "https://nodejs.org/"
    return 1
  fi

  if [ ! -d "node_modules" ]; then
    echo "正在用 npm 安装依赖..."
    npm install || return 1
  fi
}

close_launcher_window() {
  if [ "${TERM_PROGRAM:-}" != "Apple_Terminal" ] || ! has_command osascript; then
    return 0
  fi

  (
    sleep 0.5
    osascript >/dev/null 2>&1 <<APPLESCRIPT
tell application "Terminal"
  repeat with terminalWindow in windows
    if name of terminalWindow contains "${TERMINAL_TITLE}" then
      close terminalWindow
      exit repeat
    end if
  end repeat
end tell
APPLESCRIPT
  ) &
}

start_tauri_dev_in_background() {
  mkdir -p "${LOG_DIR}" || return 1

  nohup npm run tauri dev >>"${LOG_FILE}" 2>&1 </dev/null &
  local launcher_pid=$!
  disown "${launcher_pid}" >/dev/null 2>&1 || true

  sleep 2
  if ! kill -0 "${launcher_pid}" >/dev/null 2>&1; then
    echo "Time-butler 开发热更新版启动失败。"
    echo "请查看日志：${LOG_FILE}"
    return 1
  fi
}

echo "正在启动 Time-butler 开发热更新版..."
echo

if ! has_command cargo; then
  echo "没有找到 Rust / cargo，无法启动开发热更新版。"
  echo "这个项目现在以 Tauri 开发版作为日常使用入口，不再使用打包 App。"
  echo "请先安装 Rust：https://www.rust-lang.org/tools/install"
  exit 1
fi

if port_is_listening; then
  stop_existing_frontend
fi

install_with_npm_if_needed || exit 1

start_tauri_dev_in_background || exit 1

echo
echo "Time-butler 开发热更新版已在后台启动。"
echo "日志位置：${LOG_FILE}"

close_launcher_window
exit 0
