# Verification Blockers

Updated: 2026-09-28

## Current state

The current merged release lives on the repository default branch `main`; this document intentionally avoids hard-coding a moving SHA.

PRs #100–#105 are merged. The current release train includes commercial proof hardening, static-export web provenance endpoints, reconciled readiness evidence, exact-SHA soak binding, soak-evidence durability, and current release documentation.

The remaining blockers are primarily production/runtime/external evidence, not missing core architecture.

## Vercel deployment evidence

The connected `orbit-marketing-os` project is live and has a READY governed Git production deployment for the latest verified release cycle.

Current verified facts:

- public home/pricing/privacy paths respond successfully on the last verified production deployment;
- unknown routes return 404;
- Arabic RTL markup is present;
- selected seven-day runtime-error aggregation reports no runtime errors;
- Vercel production metadata reports `framework: nextjs` and Git source on the verified deployment;
- the repository now has a release-aware ignored-build policy so release metadata/provenance changes cannot be silently skipped by Vercel;
- the latest verified current-main release cycle completed the Vercel Git provenance cycle successfully;
- repository `vercel.json` expects Next.js static export to `packages/web/out`.

The remaining Vercel blocker is now the production rollback drill only; current-main deployment/provenance is verified.

The GitHub Vercel deployment lane is governed, exact-SHA bound, and live-provenance checked.

## Reproducible installation

The canonical `pnpm-lock.yaml` and desktop `Cargo.lock` are present on main and frozen-install validation passes in hosted CI.

## Governance

The live GitHub branch metadata verifies `main` is protected with required `ci` and `security:scan` checks.

## Release consequence

Do not publish a commercial release or label the product production-ready while required runtime, connector, distribution, provenance, governance, legal or billing evidence remains unverified or externally blocked.
