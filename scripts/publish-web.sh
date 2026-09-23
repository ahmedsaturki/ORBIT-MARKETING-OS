#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pnpm --filter @orbit/web typecheck
pnpm --filter @orbit/web build
