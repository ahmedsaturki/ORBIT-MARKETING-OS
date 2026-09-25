#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

command -v node >/dev/null 2>&1 || { echo "Node.js 22+ is required"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "pnpm 10.17.1 is required"; exit 1; }
command -v cargo >/dev/null 2>&1 || { echo "Rust/Cargo 1.98.1 is required"; exit 1; }

PNPM_VERSION="$(pnpm --version)"
if [ "$PNPM_VERSION" != "10.17.1" ]; then
  echo "Expected pnpm 10.17.1, found $PNPM_VERSION"
  exit 1
fi

pnpm install --lockfile-only --ignore-scripts
cargo generate-lockfile --manifest-path packages/desktop/src-tauri/Cargo.toml
test -s pnpm-lock.yaml
test -s packages/desktop/src-tauri/Cargo.lock
pnpm verify:workspace

echo "Reproducible lockfile bootstrap complete. Review pnpm-lock.yaml and packages/desktop/src-tauri/Cargo.lock, then commit them."
