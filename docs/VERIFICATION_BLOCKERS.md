# Verification Blockers

Updated: 2026-09-28

## Current state

The current merged release lives on the repository default branch `main`; this document intentionally avoids hard-coding a moving SHA.

The release train now includes commercial proof hardening, static-export web provenance endpoints, reconciled readiness evidence, exact-SHA soak binding, soak-evidence durability, governed current-main Vercel Git provenance, and durable release documentation.

The remaining blockers are primarily production/runtime/external evidence, not missing core architecture.

## Vercel deployment evidence

The connected `orbit-marketing-os` project is live and has a READY governed Git production deployment for the current verified main release.

Current verified facts:

- public home, pricing, legal routes, health/release endpoints, manifest and service worker respond successfully on the verified production deployment;
- unknown routes return 404;
- Arabic RTL markup is present;
- selected seven-day runtime-error aggregation reports no runtime errors;
- Vercel production metadata reports `framework: nextjs` and Git source on the verified deployment;
- the verified production deployment reports the exact current main SHA through Git provenance and `/api/health.json` + `/api/release.json`;
- repository `vercel.json` expects Next.js static export to `packages/web/out`;
- the repository ignore policy permits only `main` to deploy and explicitly includes release-truth changes;
- PR #129 hardens the ignore command against Vercel Root Directory cwd differences.

The current Vercel production provenance and Web Deploy checks have passed on the verified current-main cycle. The remaining Vercel action is a controlled rollback drill to the previous verified candidate and back.

## Reproducible installation

The canonical `pnpm-lock.yaml` and desktop `Cargo.lock` are present on main and frozen-install validation passes in hosted CI.

## Governance

The release controls record `main` as protected with required `ci` and `security:scan` checks. Any future release must preserve auditable governance evidence with verification timestamps.

## Release consequence

Do not publish a commercial release or label the product production-ready while required runtime, connector, distribution, rollback, governance, legal or billing evidence remains unverified or externally blocked.