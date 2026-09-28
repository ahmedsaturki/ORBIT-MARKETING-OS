#!/usr/bin/env bash
set -u

# Vercel ignore command contract:
# exit 0 = skip build; exit 1 = build.
# ORBIT only permits Vercel Git builds from the protected main branch.
if [[ "${VERCEL_GIT_COMMIT_REF:-}" != "main" ]]; then
  echo "Vercel Git deployment skipped: only the protected main branch may build."
  exit 0
fi

# A missing previous SHA / shallow-history case on main is fail-open to build.
if [[ -z "${VERCEL_GIT_PREVIOUS_SHA:-}" || -z "${VERCEL_GIT_COMMIT_SHA:-}" ]]; then
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 1
cd "$REPO_ROOT" || exit 1

if ! git rev-parse --verify "${VERCEL_GIT_PREVIOUS_SHA}^{commit}" >/dev/null 2>&1; then
  exit 1
fi
if ! git rev-parse --verify "${VERCEL_GIT_COMMIT_SHA}^{commit}" >/dev/null 2>&1; then
  exit 1
fi

MARKER="release/PRODUCTION_RELEASE.json"

# The first bootstrap marker is intentionally non-production and must not
# consume a production deployment attempt. Future non-bootstrap marker
# changes are the sole production deployment trigger.
if git diff --quiet "${VERCEL_GIT_PREVIOUS_SHA}" "${VERCEL_GIT_COMMIT_SHA}" -- "$MARKER"; then
  echo "Vercel Git deployment skipped: no explicit production release marker change."
  exit 0
fi

if [[ ! -f "$MARKER" ]]; then
  echo "Production release marker is missing after a triggering change; building fails closed."
  exit 1
fi

if grep -Eq '"releaseId"[[:space:]]*:[[:space:]]*"bootstrap"' "$MARKER"; then
  echo "Vercel Git deployment skipped: bootstrap production marker is not a release."
  exit 0
fi

echo "Vercel Git deployment triggered by explicit production release marker."
exit 1
