# Validation artifact only — this script does not produce a signed store release.

#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

test -f pnpm-lock.yaml
pnpm verify:workspace
pnpm verify:release
pnpm security:scan
pnpm install --frozen-lockfile
pnpm --filter @orbit/mobile typecheck
pnpm --filter @orbit/mobile test
pnpm --dir packages/mobile exec expo export --platform web

test -d packages/mobile/dist
