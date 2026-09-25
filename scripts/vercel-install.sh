#!/usr/bin/env bash
set -euo pipefail

if [ ! -s pnpm-lock.yaml ]; then
  echo "ERROR: pnpm-lock.yaml is required for a reproducible Vercel build."
  echo "Generate and commit the lockfile before enabling web deployment."
  exit 1
fi

exec pnpm install --frozen-lockfile
