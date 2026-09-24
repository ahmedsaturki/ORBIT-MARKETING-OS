#!/usr/bin/env bash
set -u

# Vercel ignore command contract:
# exit 0 = skip build; exit 1 = build.
# A missing previous SHA is a first deployment / shallow-history case: build.
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
