# ORBIT Marketing OS — Release Readiness

Updated: 2026-09-26.

## Canonical state

- `main`: `08e0f61e881dc94901cfb280948a29f73508fd65`
- PR #71: merged — release truth / Universal Search hardening.
- PR #72: merged — Publishing Workbench / Competitive Watch.
- PR #76: merged — fail-closed Vercel production credential gate.

## Readiness rule

ORBIT uses four levels:

- **L0 Designed**
- **L1 Implemented**
- **L2 Verified**
- **L3 Production Proven**

A capability is not treated as production-proven from source inspection or a passing unit test alone. The acceptance chain is:

SPEC → IMPLEMENT → UNIT TEST → INTEGRATION → E2E → SECURITY → PERFORMANCE → RECOVERY → REAL-WORLD EVIDENCE → DOCUMENTATION → RELEASE.

Commercial Production Proven requires every release-critical gate to reach **L3**.

The machine-readable source of truth is `release/readiness.json`. Run:

`pnpm verify:readiness`

For the commercial lane, run:

`pnpm verify:readiness -- --mode commercial`

## Current state

The current merged release train has strong L2 evidence across the core architecture, queue/policy execution, research intelligence, Universal Search, Publishing Workbench, Competitive Watch, workspace isolation, native desktop/mobile validation, and web quality.

A Windows Native E2E run previously found a real SQLite LIKE-escaping defect in Universal Search. The defect was fixed and the corrected feature head subsequently passed CI, desktop native, mobile, and Windows Native E2E.

## Production gates still open

- real Telegram authorization and controlled delivery;
- real LinkedIn authorization and controlled publishing;
- live multi-device CRDT verification;
- dedicated restart/migration/crash recovery evidence consolidation;
- manual WCAG/RTL audit;
- 24-hour stability soak;
- Vercel project settings reconciliation;
- credential-backed Vercel prebuilt deployment with embedded Git SHA verification;
- production rollback drill;
- desktop signing/notarization;
- Android/iOS production signing and store distribution;
- GitHub main branch protection/rulesets;
- commercial payment/billing activation;
- final legal/commercial publication review.

## Web production evidence

The connected Vercel project is live and the public surface currently returns healthy responses for the home, pricing, and privacy paths, with a 404 for an unknown route and no grouped runtime errors in the selected seven-day query.

The current production deployment, however, predates `main=377e86d` and does not expose the merged release SHA. It is therefore healthy live infrastructure, not yet canonical release provenance.

## Distribution posture

Desktop artifacts are technically buildable on Windows/Linux/macOS architectures and the validation workflow generates checksums. Current releases remain validation/prerelease artifacts and are not commercial signed distribution.

Mobile validation is passing, but production signing/store distribution remains a separate gate.

## Safety boundary

ORBIT intentionally excludes CAPTCHA bypass, fingerprint spoofing, anti-abuse evasion, concealed automation, and unauthorized bulk messaging. External execution remains user-authorized, policy-governed, bounded, and auditable.
