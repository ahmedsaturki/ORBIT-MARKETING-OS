# Verification Blockers

Updated: 2026-09-28

## Current state

The current merged release lives on the repository default branch `main`; this document intentionally avoids hard-coding a moving SHA.

The release train includes commercial proof hardening, static-export web provenance endpoints, reconciled readiness evidence, exact-SHA soak binding, soak-evidence durability, current production provenance hardening, repository-root-safe Vercel ignore behavior, and durable release documentation.

The remaining blockers are primarily production/runtime/external evidence, not missing core architecture.

## Vercel deployment evidence

The connected `orbit-marketing-os` project is live and has a READY governed Git production deployment for the current verified main release.

Current verified facts:

- public home/pricing/privacy paths respond successfully on the verified production deployment;
- unknown routes return 404;
- Arabic RTL markup is present;
- selected seven-day runtime-error aggregation reports no runtime errors;
- Vercel production metadata reports `framework: nextjs` and Git source;
- the verified production deployment exposes exact Git SHA `7fb96ad7b73af0b05eaa605cfaf7cca5368bc9e6`;
- repository `vercel.json` expects Next.js static export to `packages/web/out`;
- the ignore policy permits only `main` to deploy and explicitly includes release-truth changes;
- PR #129 makes the Ignore Build Step independent of Vercel Root Directory cwd.

The current Vercel production deployment and public provenance verification passed for the exact main SHA. The remaining Vercel gate is the production rollback drill.

## Reproducible installation

The canonical `pnpm-lock.yaml` and desktop `Cargo.lock` are present on main and frozen-install validation passes in hosted CI.

## Governance

The release controls record `main` as protected with required `ci` and `security:scan` checks. Any future release must preserve auditable governance evidence with verification timestamps.

## Release consequence

Do not publish a commercial release or label the product production-ready while required runtime, connector, distribution, provenance, governance, legal or billing evidence remains unverified or externally blocked.
