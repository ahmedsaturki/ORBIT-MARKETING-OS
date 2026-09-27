# Verification Blockers

Updated: 2026-09-27

## Current state

The current merged release lives on the repository default branch `main`; this document intentionally avoids hard-coding a moving SHA.

PRs #100–#104 are merged. The current release train includes commercial proof hardening, static-export web provenance endpoints, reconciled readiness evidence, exact-SHA soak binding, and current release documentation. PR #105 is the active soak-evidence hardening line.

The remaining blockers are primarily production/runtime/external evidence, not missing core architecture.

## Vercel deployment evidence

The connected `orbit-marketing-os` project is live and has a READY production deployment.

Current verified facts:

- public home/pricing/privacy paths respond successfully;
- unknown routes return 404;
- Arabic RTL markup is present;
- selected seven-day runtime-error aggregation reports no runtime errors;
- current READY deployment metadata reports `framework: vite` and empty Git metadata;
- repository `vercel.json` expects Next.js static export to `packages/web/out`.

The remaining Vercel blocker is configuration/provenance reconciliation plus a credential-backed current-main prebuilt deployment and rollback drill.

The GitHub Vercel deployment lane is credential-gated, fail-closed, exact-SHA bound, prebuilt, and live-provenance checked.

## Reproducible installation

The canonical `pnpm-lock.yaml` and desktop `Cargo.lock` are present on main and frozen-install validation passes in hosted CI.

## Governance

The GitHub branch-protection endpoint is not accessible through the current integration and returns 403. Main-branch protection/ruleset enforcement therefore remains unverified.

## Release consequence

Do not publish a commercial release or label the product production-ready while required runtime, connector, distribution, provenance, governance, legal or billing evidence remains unverified or externally blocked.
