# ORBIT Verification Snapshot — 2026-09-25

## Source of truth

- Default branch: `main`
- Current main HEAD at snapshot: `4036f88362d81eef1ae449616c272fa8c7e42db0`
- PR #29 merged: encrypted CRDT disconnect/reconnect convergence and wrong-key replay regression are now on main.
- PR #27 remains the only open pull request for legacy-surface cleanup/native validation.

## Verified main evidence

Main CI run `36144303102` passed on the PR #29 merge commit, including:

- reproducible frozen install;
- release sanity;
- secret scan;
- dependency audit;
- workspace sanity;
- TypeScript typecheck;
- Desktop IPC contract;
- lint;
- tests;
- coverage;
- runtime smoke;
- performance smoke;
- build;
- Playwright browser E2E;
- format check;
- Rust fmt/check/test/clippy.

Main Web Deploy run `36144303202` passed its Web quality gate and was associated with a READY production web deployment.

## Live web evidence

Direct Vercel fetches against `orbit-marketing-os.vercel.app` returned:

- HTTP 200 for home, pricing, privacy, terms, refunds, EULA, manifest and service worker;
- HTTP 404 for an unknown route;
- HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP and CORP headers.

Vercel runtime error aggregation for the selected seven-day period reports no runtime errors.

## Native validation

PR #27 has successful Windows x64, Linux x64, macOS x64 and macOS ARM64 desktop bundle jobs. Windows native E2E and Android debug validation remain active gates in the recorded workflow run.

## Remaining release gates

- dedicated native restart/migration/crash-recovery acceptance;
- real authorized Telegram delivery test;
- real authorized LinkedIn publishing test;
- live multi-device CRDT network evidence;
- manual accessibility audit;
- 24-hour soak and recovery evidence;
- full desktop real-instance workflow;
- full RBAC negative matrix;
- final release-tag checksum/provenance;
- desktop signing/notarization;
- Android/iOS production signing and store release;
- Vercel project-setting provenance reconciliation and rollback drill;
- payment/refund configuration and verification;
- final legal/commercial review.

## Evidence rule

Implementation presence is not release evidence. Only current execution records, artifacts, or controlled human-authorized tests may move an applicable gate to VERIFIED.
