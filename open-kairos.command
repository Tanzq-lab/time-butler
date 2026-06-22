#!/bin/zsh

set -u

cd -- "$(dirname "$0")" || exit 1

export PATH="${HOME}/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:${PATH}"

PORT=1420

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

echo "正在启动时间管家桌面版..."
echo

if ! has_command cargo; then
  echo "没有找到 Rust / cargo，无法启动桌面版。"
  echo "这个项目现在只保留一个桌面版本，不再打开浏览器预览版。"
  echo "请先安装 Rust：https://www.rust-lang.org/tools/install"
  exit 1
fi

if port_is_listening; then
  stop_existing_frontend
fi

install_with_npm_if_needed || exit 1

npm run tauri dev

echo
echo "时间管家已停止。"
