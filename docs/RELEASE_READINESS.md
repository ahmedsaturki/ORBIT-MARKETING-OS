# ORBIT Marketing OS — Release Readiness

Updated: 2026-09-26

## Current release line

The consolidated production implementation is merged into main through the RC2.1 line and PR #47. The authoritative current main commit is `bd174e7e52a6ba69b4c54618e7a635e90bace611`.

PR #45 established the RC2.1 native/release baseline. PR #47 added the governed Command Registry and Operational Event Spine on top of the current main lineage and passed all exact-head CI/native/mobile gates before merge.

The current validation branch adds the Command Dispatcher on top of that verified lineage and is not considered releasable until its exact-head gates pass.

## Verified execution baseline

PR #47 exact head `d48f00e93a60d9c85e191099419f659bc94e64c9` passed:

- CI run 36198100587;
- Desktop Native Validation run 36198100491;
- Mobile Validation run 36198100618.

The merged main tree therefore has fresh exact-head evidence for the governed control-plane merge.

## Verified production web

Vercel project `orbit-marketing-os` has a READY production deployment and the live public web surface remains available. Current project metadata reports `framework: vite`, while the repository release contract expects a Next.js static export to `packages/web/out`. The latest READY deployment has empty Git metadata, so repository provenance is not treated as verified.

Current runtime error aggregation for the selected 7-day period reports no runtime error clusters.

## Remaining release gates

- current Command Dispatcher exact-head verification;
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
