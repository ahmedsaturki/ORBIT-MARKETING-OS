#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

test -f pnpm-lock.yaml
pnpm verify:workspace
pnpm install --frozen-lockfile
pnpm --filter @orbit/desktop typecheck
pnpm --filter @orbit/desktop build
pnpm --dir packages/desktop tauri icon src-tauri/icon-source.svg
pnpm --dir packages/desktop tauri build
