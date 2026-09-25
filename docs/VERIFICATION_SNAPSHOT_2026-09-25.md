# ORBIT Verification Snapshot — 2026-09-25

## Current canonical cut

- Default branch: `main`
- Current open implementation PR: #35
- PR #35 head: `b0ee492275b9cd56353a3bcfcb6e2499820da7af`
- PR #35 is open, non-draft, unmerged.

## Exact-head verification

The immediately preceding PR #35 head had a complete CI quality PASS; the current exact head is `b0ee492...` after documentation/cleanup changes and has fresh CI validation active.

- reproducible frozen install;
- release sanity and secret scan;
- dependency audit;
- workspace sanity;
- TypeScript typecheck and Desktop IPC checks;
- lint, unit/integration tests and coverage;
- local-runtime smoke and performance smoke;
- monorepo build;
- browser E2E;
- format check.

The immediately preceding PR #35 head had a complete Rust quality PASS; fresh exact-head validation is active.

- rustfmt;
- cargo check;
- cargo test;
- clippy with warnings denied.

Native desktop validation has produced successful bundles for:

- Windows x64;
- Linux x64;
- macOS x64;
- macOS arm64.

The current exact-head native validation result is not claimed until its fresh jobs settle.

## Web production

The connected Vercel project `orbit-marketing-os` has a READY production deployment at `orbit-marketing-os.vercel.app`.

Direct verification has passed for:

- home;
- pricing;
- privacy;
- terms;
- refunds;
- EULA;
- manifest;
- service worker;
- unknown-route 404;
- HSTS and the expected browser security headers.

The current READY deployment metadata is empty, so it is not treated as proof of the guarded GitHub prebuilt provenance path. Effective Vercel project metadata still reports `framework: vite`, while the repository contract intentionally uses the static-export configuration in `vercel.json`.

## Remaining release gates

- Windows native E2E and Android debug artifact validation on PR #35;
- merge PR #35 and run post-merge verification on the exact resulting main head;
- dedicated real-instance desktop restart/migration/crash-recovery acceptance;
- controlled live Telegram authorization/delivery test;
- controlled live LinkedIn authorization/publishing test;
- live multi-device CRDT network evidence beyond simulation;
- dedicated accessibility/RTL audit;
- 24-hour soak and recovery evidence;
- final checksum/provenance release verification;
- desktop signing/notarization;
- Android/iOS production signing and store distribution;
- Vercel guarded deployment provenance and rollback drill;
- payment/refund configuration and final legal/commercial review.

## Evidence rule

Implementation presence is not release evidence. A gate moves to VERIFIED only when its current execution, artifact, or controlled human-authorized evidence exists.
