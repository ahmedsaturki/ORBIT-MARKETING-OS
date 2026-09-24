#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

command -v node >/dev/null 2>&1 || { echo "Node.js is required"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "pnpm 10.17.1 is required"; exit 1; }

PNPM_VERSION="$(pnpm --version)"
if [ "$PNPM_VERSION" != "10.17.1" ]; then
  echo "Expected pnpm 10.17.1, found $PNPM_VERSION"
  exit 1
fi

pnpm install --no-frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
