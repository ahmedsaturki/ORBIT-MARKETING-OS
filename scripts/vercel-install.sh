#!/usr/bin/env bash
set -euo pipefail

if [ -s pnpm-lock.yaml ]; then
  exec pnpm install --frozen-lockfile
fi

echo "pnpm-lock.yaml is not committed yet; bootstrapping dependencies for this transitional web build."
exec pnpm install --no-frozen-lockfile
