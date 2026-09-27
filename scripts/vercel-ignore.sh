#!/usr/bin/env bash
set -u

# Vercel ignore command contract:
# exit 0 = skip build; exit 1 = build.
# ORBIT only permits Vercel Git builds from the protected main branch.
if [[ "${VERCEL_GIT_COMMIT_REF:-}" != "main" ]]; then
  echo "Vercel Git deployment skipped: only the protected main branch may build."
  exit 0
fi

# A missing previous SHA / shallow-history case on main is a first deployment: build.
if [[ -z "${VERCEL_GIT_PREVIOUS_SHA:-}" || -z "${VERCEL_GIT_COMMIT_SHA:-}" ]]; then
  exit 1
fi

if [[ -z "${VERCEL_GIT_PREVIOUS_SHA:-}" || -z "${VERCEL_GIT_COMMIT_SHA:-}" ]]; then
  exit 1
fi

if ! git rev-parse --verify "${VERCEL_GIT_PREVIOUS_SHA}^{commit}" >/dev/null 2>&1; then
  exit 1
fi

if ! git rev-parse --verify "${VERCEL_GIT_COMMIT_SHA}^{commit}" >/dev/null 2>&1; then
  exit 1
fi

git diff --quiet "${VERCEL_GIT_PREVIOUS_SHA}" "${VERCEL_GIT_COMMIT_SHA}" --   packages/web   vercel.json   package.json   pnpm-workspace.yaml   pnpm-lock.yaml
status=$?

case "$status" in
  0) exit 0 ;;
  1) exit 1 ;;
  *) exit 1 ;;
esac
