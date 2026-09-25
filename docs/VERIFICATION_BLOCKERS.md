# Verification Blockers

Updated: 2026-09-26

## Current state

The earlier hosted-runner pre-step failure is historical. Current GitHub-hosted CI executes real workflow steps and PR #47 completed CI, Desktop Native Validation and Mobile Validation successfully before merge.

The current validation branch also has fresh hosted runs for the Command Dispatcher release candidate. Their exact-head outcomes must settle before merge.

## Vercel deployment evidence

The Vercel project `orbit-marketing-os` is connected and has a READY production deployment.

Current verified facts:

- project metadata reports `framework: vite`;
- repository deployment contract expects Next.js static export to `packages/web/out`;
- latest READY production deployment has empty Git metadata;
- the selected seven-day runtime error aggregation currently reports no runtime errors.

The remaining Vercel blocker is therefore configuration/provenance reconciliation and a fresh rollback drill, not general web availability.

## Reproducible installation

The canonical `pnpm-lock.yaml` and `packages/desktop/src-tauri/Cargo.lock` are present on the current main lineage and have passed frozen-install validation in hosted CI. No fabricated lockfile is part of the release process.

## Local execution

The developer shell's external network limitations are not treated as the primary release path. GitHub-hosted validation is the authoritative zero-cost automated verification path, with the repository's self-hosted workflow retained as a manual fallback.

## Governance

Live GitHub ruleset read currently returns an empty ruleset collection. Main-branch protection/direct-push enforcement therefore remains unverified and is kept as an open governance gate.

## Release consequence

Do not publish a commercial release or label the product production-ready while required runtime, connector, distribution, provenance, governance, legal or billing evidence remains unverified or externally blocked.
