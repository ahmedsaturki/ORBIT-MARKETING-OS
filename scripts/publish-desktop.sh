#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pnpm --filter @orbit/desktop typecheck
pnpm --filter @orbit/desktop build
pnpm --dir packages/desktop tauri build
