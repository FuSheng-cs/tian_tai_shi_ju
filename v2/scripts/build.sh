#!/usr/bin/env bash
set -euo pipefail
v2_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -x /workspace/.tools/go/bin/go ]]; then
  export PATH="/workspace/.tools/go/bin:$PATH"
fi
export GOTOOLCHAIN=local
export GOPATH="${GOPATH:-/workspace/.cache/go}"
export GOCACHE="${GOCACHE:-/workspace/.cache/go-build}"
export GOFLAGS=-mod=readonly
mkdir -p "$v2_dir/.run" "$GOPATH" "$GOCACHE"
cd "$v2_dir/server"
go version
go test -race ./...
go build -trimpath -o "$v2_dir/.run/tiantai-v2" .
cd "$v2_dir/web"
npm ci --cache /tmp/tian-tai-npm-cache
npm test
npm run lint
npm run build
printf 'Built v2: %s/.run/tiantai-v2 and %s/web/dist\n' "$v2_dir" "$v2_dir"
