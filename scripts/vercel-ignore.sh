#!/usr/bin/env bash
set -u

# Vercel ignore command contract:
# exit 0 = skip build; exit 1 = build.
# ORBIT only permits Vercel Git builds from the protected main branch.
if [[ "${VERCEL_GIT_COMMIT_REF:-}" != "main" ]]; then
  echo "Vercel Git deployment skipped: only the protected main branch may build."
  exit 0
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 1
cd "$REPO_ROOT" || exit 1

# Compare the commit being considered with its first parent. Vercel's
# VERCEL_GIT_PREVIOUS_SHA is the last successful deployment, not necessarily
# the previous Git commit, so using it would make an old release-marker change
# look new again after later commits. HEAD^ keeps the decision local to this
# exact Git commit and its parent.
if ! git rev-parse --verify HEAD^ >/dev/null 2>&1; then
  echo "Vercel Git deployment cannot establish the current commit parent; building fails closed."
  exit 1
fi

MARKER="release/PRODUCTION_RELEASE.json"

if git diff --quiet HEAD^ HEAD -- "$MARKER"; then
  echo "Vercel Git deployment skipped: current commit does not change the production release marker."
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
