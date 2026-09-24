#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -s pnpm-lock.yaml ]; then
  echo "pnpm-lock.yaml is required. Run scripts/bootstrap-lockfile.sh first."
  exit 1
fi

pnpm verify:workspace
pnpm verify:release
pnpm security:scan
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm test:runtime
pnpm test:performance
pnpm build
pnpm format:check
