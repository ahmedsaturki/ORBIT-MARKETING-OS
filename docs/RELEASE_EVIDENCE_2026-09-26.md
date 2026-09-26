# ORBIT Release Evidence — 2026-09-26

## Canonical main

GitHub currently resolves the repository default branch `main` to:

`08e0f61e881dc94901cfb280948a29f73508fd65`

This signed merge commit contains the verified Release Truth / Universal Search hardening from PR #71 and the verified Publishing Workbench / Competitive Watch tranche from PR #72.

## Exact-head verified feature evidence

### PR #71 — Release Truth / Universal Search

- merged to `main` as `b53728ad9697b12c6ce3e2fbf18f5d5d732afc2e`;
- CI, Rust quality, Mobile Validation and the corrected Windows Native E2E evidence were completed on the release line;
- Windows Native E2E exposed a real SQLite LIKE escaping defect; the fix switched to a portable `!` escape character and added literal wildcard regression coverage.

### PR #72 — Publishing Workbench / Competitive Watch

Feature head:

`d24aab486866b20c69b74c2f4cde9ab6e463b0b6`

Terminal exact-head evidence:

- CI: success;
- Rust quality: success;
- Desktop Native Validation: success;
- Mobile Validation: success;
- Windows Native E2E: success;
- Linux x64 desktop build: success;
- Windows x64 desktop build: success;
- macOS x64 desktop build: success;
- macOS ARM64 desktop build: success;
- SonarCloud: success;
- vulnerability analysis: neutral.

Merged to `main` as:

`377e86d79c3c9718ca8ee4d9ce5161a5751f77a3`

## Product additions now on main

- queue-backed Publishing Calendar;
- governed Bulk Planner with bounded inputs and approval enforcement;
- Competitive Watch for RBM Cloud, RBM Tools, RBM WhatsApp Cloud, Buffer, Metricool and Publer;
- workspace-namespaced competitor source identities;
- Universal Search hardening and wildcard regression coverage.

## Current public web evidence

Connected Vercel project: `orbit-marketing-os`.

The public surface currently responds successfully for the home, pricing and privacy routes, returns 404 for an unknown route, uses Arabic RTL markup, and the selected seven-day runtime-error aggregation is clean.

The current READY production deployment predates `main=08e0f61` and does not expose the merged release SHA in its deployment metadata. Therefore live availability is verified, but current-main production provenance is not.

## Current release gate correction

PR #76 changed the Vercel workflow from soft-disable to fail-closed when `VERCEL_TOKEN`, `VERCEL_ORG_ID` or `VERCEL_PROJECT_ID` is absent. This prevents a false green from being interpreted as a real deployment.

## Remaining evidence

- current-main Vercel credential-backed prebuilt deployment and embedded SHA verification;
- Vercel project settings reconciliation;
- production rollback drill;
- real Telegram authorization/delivery;
- real LinkedIn authorization/publishing;
- live multi-device CRDT network evidence;
- consolidated native recovery evidence;
- manual WCAG/RTL audit;
- 24-hour stability soak;
- final release checksum/provenance drill;
- desktop signing/notarization;
- production Android/iOS signing and store distribution;
- GitHub main branch protection/rulesets;
- commercial payment/billing;
- final legal/commercial publication review.

## Rule

`IMPLEMENTED` is not `VERIFIED`; `VERIFIED` is not `PRODUCTION PROVEN`.

No commercial release is claimed while a required gate remains `UNVERIFIED` or `BLOCKED`.
