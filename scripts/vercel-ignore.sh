#!/usr/bin/env bash
set -u

# Vercel ignore command contract:
# exit 0 = skip build; exit 1 = build.
# ORBIT only permits Vercel Git builds from the protected main branch.
#
# IMPORTANT: main is fail-closed for deployment filtering. Every main push
# must produce a deployable provenance candidate so the public release SHA
# cannot remain pinned to an older production deployment because a local
# checkout/pathspec behaves differently inside Vercel's ignore step.
if [[ "\${VERCEL_GIT_COMMIT_REF:-}" != "main" ]]; then
  echo "Vercel Git deployment skipped: only the protected main branch may build."
  exit 0
fi

# Missing revision metadata is unsafe to use for an ignore decision; build.
if [[ -z "\${VERCEL_GIT_PREVIOUS_SHA:-}" || -z "\${VERCEL_GIT_COMMIT_SHA:-}" ]]; then
  echo "Vercel Git deployment required: incomplete Git revision context."
  exit 1
fi

# Validate that both revisions exist when Git metadata is available. This is
# diagnostic/defensive only; the main branch still always builds after this.
REPO_ROOT="\$(git rev-parse --show-toplevel 2>/dev/null)" || exit 1
cd "\$REPO_ROOT" || exit 1

if ! git rev-parse --verify "\${VERCEL_GIT_PREVIOUS_SHA}^{commit}" >/dev/null 2>&1; then
  echo "Vercel Git deployment required: previous SHA is unavailable."
  exit 1
fi

if ! git rev-parse --verify "\${VERCEL_GIT_COMMIT_SHA}^{commit}" >/dev/null 2>&1; then
  echo "Vercel Git deployment required: current SHA is unavailable."
  exit 1
fi

echo "Vercel Git deployment required: protected main is always deployable."
exit 1
