#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

test -f pnpm-lock.yaml
pnpm verify:workspace
pnpm install --frozen-lockfile
pnpm --filter @orbit/web typecheck
pnpm --filter @orbit/web lint
pnpm --filter @orbit/web build
