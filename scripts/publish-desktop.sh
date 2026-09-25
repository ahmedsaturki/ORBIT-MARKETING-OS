#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

test -f pnpm-lock.yaml
test -f packages/desktop/src-tauri/Cargo.lock
pnpm verify:workspace
pnpm verify:release
pnpm security:scan
pnpm install --frozen-lockfile
pnpm --filter @orbit/desktop typecheck
pnpm --filter @orbit/desktop build
pnpm --dir packages/desktop tauri icon src-tauri/icon-source.svg
pnpm --dir packages/desktop tauri build

# Tauri must produce distributable bundles; do not report success on a compile-only result.
test -d packages/desktop/src-tauri/target/release/bundle
find packages/desktop/src-tauri/target/release/bundle -type f | grep -q .
