#!/usr/bin/env bash
set -euo pipefail
v2_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -x /workspace/.tools/go/bin/go ]]; then
  export PATH="/workspace/.tools/go/bin:$PATH"
fi
export GOTOOLCHAIN=local
export GOPATH="${GOPATH:-/workspace/.cache/go}"
export GOCACHE="${GOCACHE:-/workspace/.cache/go-build}"
export V2_DATA_DIR="${V2_DATA_DIR:-$v2_dir/.run/sessions}"
export V2_LISTEN_ADDR="${V2_LISTEN_ADDR:-127.0.0.1:8082}"
mkdir -p "$v2_dir/.run" "$GOPATH" "$GOCACHE"
[[ -d "$v2_dir/web/node_modules" ]] || { printf 'Run npm ci in v2/web first.\n' >&2; exit 1; }
cd "$v2_dir/server"
go build -trimpath -o "$v2_dir/.run/tiantai-v2" .
"$v2_dir/.run/tiantai-v2" &
backend_pid=$!
frontend_pid=''
cleanup() {
  if [[ -n "$frontend_pid" ]]; then kill "$frontend_pid" 2>/dev/null || true; fi
  kill "$backend_pid" 2>/dev/null || true
  wait "$backend_pid" 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
cd "$v2_dir/web"
# Direct process ownership lets the exit trap stop exactly this Vite process.
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5174 --strictPort &
frontend_pid=$!
wait -n "$backend_pid" "$frontend_pid"
