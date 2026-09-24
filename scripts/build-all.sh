#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -f pnpm-lock.yaml ]; then
  pnpm install --frozen-lockfile
else
  pnpm install --lockfile-only --ignore-scripts
  test -f pnpm-lock.yaml
  pnpm install --frozen-lockfile
fi

pnpm verify:workspace
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm format:check
