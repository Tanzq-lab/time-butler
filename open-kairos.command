#!/bin/zsh

set -u

cd -- "$(dirname "$0")" || exit 1

PORT=1420
URL="http://localhost:${PORT}/"
SERVER_PID=""
TEMP_PROFILE_DIR=""
DEV_LOG=""
OWNS_SERVER=0

has_command() {
  command -v "$1" >/dev/null 2>&1
}

port_is_listening() {
  lsof -nP -iTCP:"${PORT}" -sTCP:LISTEN >/dev/null 2>&1
}

cleanup() {
  if [ "${OWNS_SERVER}" -eq 1 ]; then
    echo
    echo "正在清理后台服务和临时文件..."

    local listener_pids
    listener_pids="$(lsof -tiTCP:"${PORT}" -sTCP:LISTEN 2>/dev/null || true)"

    if [ -n "${listener_pids}" ]; then
      kill ${listener_pids} >/dev/null 2>&1 || true
    fi

    if [ -n "${SERVER_PID}" ]; then
      kill "${SERVER_PID}" >/dev/null 2>&1 || true
    fi
  fi

  if [ -n "${TEMP_PROFILE_DIR}" ] && [ -d "${TEMP_PROFILE_DIR}" ]; then
    rm -rf "${TEMP_PROFILE_DIR}"
  fi

  if [ -n "${DEV_LOG}" ] && [ -f "${DEV_LOG}" ]; then
    rm -f "${DEV_LOG}"
  fi
}

trap cleanup EXIT INT TERM

wait_until_ready() {
  for _ in {1..80}; do
    if curl -fsS "${URL}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.5
  done

  echo
  echo "本地服务没有按时启动成功。"
  echo "你可以稍后手动尝试打开：${URL}"
  return 1
}

find_chromium_browser() {
  local candidates=(
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
    "/Applications/Chromium.app/Contents/MacOS/Chromium"
  )

  local candidate
  for candidate in "${candidates[@]}"; do
    if [ -x "${candidate}" ]; then
      echo "${candidate}"
      return 0
    fi
  done

  return 1
}

open_browser_and_wait() {
  local browser_bin
  browser_bin="$(find_chromium_browser || true)"

  if [ -n "${browser_bin}" ]; then
    TEMP_PROFILE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/time-butler-browser-profile.XXXXXX")"
    echo "正在用独立浏览器窗口打开时间管家。"
    echo "关闭这个窗口后，我会自动停止本地服务。"
    echo
    "${browser_bin}" \
      --app="${URL}" \
      --user-data-dir="${TEMP_PROFILE_DIR}" \
      --no-first-run \
      --no-default-browser-check \
      >/dev/null 2>&1
  else
    echo "没有找到 Chrome、Edge、Brave 或 Chromium，无法自动等待窗口关闭。"
    echo "将改用你的默认浏览器打开。"
    echo "用完后，请回到这个窗口按 Enter 停止时间管家。"
    echo
    open "${URL}"
    read -r "?关闭页面后按 Enter 继续..."
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

install_with_bun_if_needed() {
  if [ ! -d "node_modules" ]; then
    echo "正在用 Bun 安装依赖..."
    bun install || return 1
  fi
}

echo "正在启动时间管家..."
echo

if port_is_listening; then
  echo "时间管家好像已经在运行了。"
  echo "正在打开 ${URL}"
  echo "这个服务不是本脚本启动的，所以关闭页面后不会自动停止它。"
  open "${URL}"
  exit 0
fi

if has_command bun && has_command cargo; then
  install_with_bun_if_needed || exit 1
  echo "正在启动完整的 Tauri 桌面版..."
  echo
  bun run tauri dev
else
  echo "没有找到 Bun 和/或 Rust，所以先打开浏览器预览版。"
  echo "提示：预览版使用内存测试数据。安装 Bun + Rust 后可启动完整桌面版。"
  echo
  install_with_npm_if_needed || exit 1
  DEV_LOG="$(mktemp "${TMPDIR:-/tmp}/time-butler-vite.XXXXXX.log")"
  E2E=true npm run dev >"${DEV_LOG}" 2>&1 &
  SERVER_PID="$!"
  OWNS_SERVER=1

  if ! wait_until_ready; then
    echo
    echo "Vite 日志："
    cat "${DEV_LOG}"
    exit 1
  fi

  open_browser_and_wait
fi

echo
echo "时间管家已停止。"
