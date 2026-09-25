# ORBIT Marketing OS — Release Readiness

Updated: 2026-09-26

## Current release line

The consolidated production implementation is merged into main through the RC2.1 line, PR #47, and PR #48. The current main commit from the dispatcher merge is `cea2873db9817d4930662747441b55e1660dd67d`.

PR #45 established the RC2.1 native/release baseline. PR #47 added the governed Command Registry and Operational Event Spine and passed all exact-head CI/native/mobile gates before merge. PR #48 added the Command Dispatcher on top of that lineage and also passed all exact-head CI/native/mobile gates before merge.

## Verified execution baseline

PR #47 exact head `d48f00e93a60d9c85e191099419f659bc94e64c9` passed CI, Desktop Native Validation, and Mobile Validation and merged to main as `bd174e7e52a6ba69b4c54618e7a635e90bace611`.

PR #48 exact head `6dccbe5c4efcfeb77c5ff87bda3d5d707b5b0301` passed CI (`36200698291`), Desktop Native Validation (`36200698273`), and Mobile Validation (`36200698316`) and merged to main as `cea2873db9817d4930662747441b55e1660dd67d`.

## Verified production web

Vercel project `orbit-marketing-os` has a READY production deployment and the live public web surface remains available. Current project metadata reports `framework: vite`, while the repository release contract expects a Next.js static export to `packages/web/out`. The latest READY deployment has empty Git metadata, so repository provenance is not treated as verified.

Current runtime error aggregation for the selected 7-day period reports no runtime error clusters.

## Remaining release gates

- dedicated native runtime restart/migration/crash-recovery acceptance;
- controlled real Telegram authorization/delivery evidence;
- controlled real LinkedIn authorization/delivery evidence;
- live multi-device CRDT network verification;
- dedicated accessibility/RTL audit;
- 24-hour stability soak;
- release-tag checksum/provenance verification;
- desktop signing/notarization;
- production Android/iOS signing and store distribution;
- Vercel project-setting reconciliation and guarded deployment provenance;
- Vercel rollback drill;
- main branch-protection/ruleset verification;
- commercial payment/billing configuration;
- final legal/commercial publication review.

## Distribution

Desktop artifacts are technically buildable and validated but remain unsigned. Mobile produces a validated Android debug artifact. Web is live in Vercel production.

No commercial launch claim is made while release-critical gates remain open.

## Safety boundary

ORBIT deliberately excludes fingerprint spoofing, CAPTCHA bypass, anti-abuse evasion, and concealed automation. External actions remain user-authorized, bounded, auditable, and stopped when authentication or challenge state is ambiguous.
