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
    echo "Cleaning up..."

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
  echo "The local server did not become ready in time."
  echo "You can try opening this URL manually: ${URL}"
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
    TEMP_PROFILE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/kairos-browser-profile.XXXXXX")"
    echo "Opening Kairos in its own browser window."
    echo "Close that window and I will stop the local server automatically."
    echo
    "${browser_bin}" \
      --app="${URL}" \
      --user-data-dir="${TEMP_PROFILE_DIR}" \
      --no-first-run \
      --no-default-browser-check \
      >/dev/null 2>&1
  else
    echo "No Chrome/Edge/Brave/Chromium browser was found for auto-wait mode."
    echo "Opening your default browser instead."
    echo "When you are done, come back here and press Enter to stop Kairos."
    echo
    open "${URL}"
    read -r "?Press Enter after closing the page..."
  fi
}

install_with_npm_if_needed() {
  if ! has_command npm; then
    echo "npm was not found. Please install Node.js first:"
    echo "https://nodejs.org/"
    return 1
  fi

  if [ ! -d "node_modules" ]; then
    echo "Installing dependencies with npm..."
    npm install || return 1
  fi
}

install_with_bun_if_needed() {
  if [ ! -d "node_modules" ]; then
    echo "Installing dependencies with Bun..."
    bun install || return 1
  fi
}

echo "Starting Kairos-Pomodoro..."
echo

if port_is_listening; then
  echo "Kairos already seems to be running."
  echo "Opening ${URL}"
  echo "I did not start that server, so I will not stop it automatically."
  open "${URL}"
  exit 0
fi

if has_command bun && has_command cargo; then
  install_with_bun_if_needed || exit 1
  echo "Launching the full Tauri desktop app..."
  echo
  bun run tauri dev
else
  echo "Bun and/or Rust were not found, so I will open the browser preview."
  echo "Tip: this preview uses in-memory test data. Install Bun + Rust for the full desktop app."
  echo
  install_with_npm_if_needed || exit 1
  DEV_LOG="$(mktemp "${TMPDIR:-/tmp}/kairos-vite.XXXXXX.log")"
  E2E=true npm run dev >"${DEV_LOG}" 2>&1 &
  SERVER_PID="$!"
  OWNS_SERVER=1

  if ! wait_until_ready; then
    echo
    echo "Vite log:"
    cat "${DEV_LOG}"
    exit 1
  fi

  open_browser_and_wait
fi

echo
echo "Kairos has stopped."
