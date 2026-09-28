# Verification Blockers

Updated: 2026-09-28

## Current state

The current merged release lives on the repository default branch `main`; this document intentionally avoids hard-coding a moving SHA.

The release train now includes commercial proof hardening, static-export web provenance endpoints, reconciled readiness evidence, exact-SHA soak binding, soak-evidence durability, governed current-main Vercel Git provenance, protected-main governance, and durable release documentation.

The remaining blockers are primarily production/runtime/external evidence, not missing core architecture or the verified web deployment path.

## Vercel deployment evidence

The connected `orbit-marketing-os` project is live and has a READY governed Git production deployment for the latest verified release cycle.

Current verified facts:

- public home/pricing/privacy paths respond successfully on the verified production deployment;
- unknown routes return 404;
- Arabic RTL markup is present;
- selected seven-day runtime-error aggregation reports no runtime errors;
- Vercel production metadata reports `framework: nextjs` and Git source on the verified deployment;
- repository `vercel.json` expects Next.js static export to `packages/web/out`;
- the repository ignore policy permits only `main` to deploy and explicitly includes release-truth changes;
- PR #129 hardens the ignore command against Vercel Root Directory cwd differences.

The last verified Vercel production provenance and Web Deploy cycle passed for main SHA `6e5d78db...`. The current `main` commit is not production-verified because no deployment for the current commit was observed; Vercel is currently returning the free deployment-per-day rate limit. After a successful current-SHA deployment is observed, the remaining Vercel action is the controlled rollback drill.

## Reproducible installation

The canonical `pnpm-lock.yaml` and desktop `Cargo.lock` are present on main and frozen-install validation passes in hosted CI.

## Governance

The release controls record `main` as protected with required `ci` and `security:scan` checks. Any future release must preserve auditable governance evidence with verification timestamps.

## Release consequence

Do not publish a commercial release or label the product production-ready while required runtime, connector, distribution, provenance, governance, legal or billing evidence remains unverified or externally blocked.
