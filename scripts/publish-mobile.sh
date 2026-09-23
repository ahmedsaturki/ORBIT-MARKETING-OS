#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pnpm --filter @orbit/mobile typecheck
pnpm --dir packages/mobile expo export --platform all
