# Verification Blockers

Updated: 2026-09-26

## Current state

The current merged main is:

`377e86d79c3c9718ca8ee4d9ce5161a5751f77a3`

PR #71 and PR #72 are merged. Their final validated feature heads passed the required hosted CI/native/mobile gates; the Windows Native E2E run also passed after exposing and driving the Universal Search escaping fix.

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

PR #76 changes the GitHub deployment workflow to fail closed when its Vercel credentials are absent, eliminating the previous false-green behavior.

## Reproducible installation

The canonical `pnpm-lock.yaml` and desktop `Cargo.lock` are present on main and frozen-install validation passes in hosted CI.

## Governance

The GitHub branch-protection endpoint is not accessible through the current integration and returns 403. Main-branch protection/ruleset enforcement therefore remains unverified.

## Release consequence

Do not publish a commercial release or label the product production-ready while required runtime, connector, distribution, provenance, governance, legal or billing evidence remains unverified or externally blocked.
