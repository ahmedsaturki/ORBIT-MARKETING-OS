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

# Vercel can execute the ignore command from a configured Root Directory
# (for example packages/web). Normalize to the repository root before using
# repository-level pathspecs so release-truth changes are never hidden by cwd.
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 1
cd "$REPO_ROOT" || exit 1

if ! git rev-parse --verify "${VERCEL_GIT_PREVIOUS_SHA}^{commit}" >/dev/null 2>&1; then
  exit 1
fi

if ! git rev-parse --verify "${VERCEL_GIT_COMMIT_SHA}^{commit}" >/dev/null 2>&1; then
  exit 1
fi

# Release-truth changes intentionally trigger a Web deployment because the
# deployment embeds VERCEL_GIT_COMMIT_SHA into the public provenance endpoints.
# Unrelated docs/core/desktop changes can still be skipped to preserve build capacity.
git diff --quiet "${VERCEL_GIT_PREVIOUS_SHA}" "${VERCEL_GIT_COMMIT_SHA}" -- \
  packages/web \
  vercel.json \
  package.json \
  pnpm-workspace.yaml \
  pnpm-lock.yaml \
  scripts/vercel-ignore.sh \
  scripts/vercel-install.sh \
  scripts/verify-live-web.mjs \
  scripts/verify-public-vercel-provenance.mjs \
  release \
  docs/RELEASE_*.md \
  docs/LAUNCH_SCORECARD.md \
  docs/PERFORMANCE_EVIDENCE.md \
  docs/COMMERCIAL_PRODUCTION_PROVEN_RUNBOOK.md \
  docs/VERIFICATION_BLOCKERS.md \
  docs/FINAL_EXTERNAL_ACTIONS.md
status=$?

case "$status" in
  0) exit 0 ;;
  1) exit 1 ;;
  *) exit 1 ;;
esac
