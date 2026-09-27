# ORBIT Marketing OS — Release Readiness

Updated: 2026-09-27.

## Canonical state

- `main`: current repository default branch (do not hard-code a moving SHA in this document)
- PR #71: merged — release truth / Universal Search hardening.
- PR #72: merged — Publishing Workbench / Competitive Watch.
- PR #76: merged — fail-closed Vercel production credential gate.
- PR #77: merged — executable production readiness gate.
- PR #78: merged — deterministic local link intelligence core.
- PR #80: merged — governed platform foundation.
- PR #83: merged — governed content reuse policy.
- PR #84: merged — SHA-independent release documentation.
- PR #85: merged — web release health/provenance checks.
- PR #86: merged — evidence-backed reporting packs.
- PR #87: merged — deterministic local link intelligence and evidence.
- PR #88: merged — encrypted sync-network convergence proof.
- PR #89: merged — auditable release evidence bundle.
- PR #93: merged — automatic exact-main release evidence.
- PR #94: merged — release evidence collector defaults safely to verification mode.
- PR #95: merged — verified regional competitor-watch expansion.
- PR #97: merged — atomic bulk task planning.
- PR #98: merged — executable readiness verifier contract.
- PR #100: merged — commercial production proof hardening and governed connector-proof lane.
- PR #101: merged — static-export web provenance endpoints and exact-SHA verification.
- PR #102: merged — release-evidence/readiness reconciliation.
- PR #103: merged — exact-SHA stability soak evidence hardening.
- PR #118: merged — consolidated base64/sha2/argon2 dependency refresh.

## Readiness rule

ORBIT uses four levels:

- **L0 Designed**
- **L1 Implemented**
- **L2 Verified**
- **L3 Production Proven**

A capability is not treated as production-proven from source inspection or a passing unit test alone. The acceptance chain is:

SPEC → IMPLEMENT → UNIT TEST → INTEGRATION → E2E → SECURITY → PERFORMANCE → RECOVERY → REAL-WORLD EVIDENCE → DOCUMENTATION → RELEASE.

Commercial Production Proven requires every release-critical gate to reach **L3**.

For a gate to carry `L3_PRODUCTION_PROVEN`, the machine-readable record must also contain non-empty `evidenceRefs` and a parseable `verifiedAt`. This prevents a plain text level change from becoming a false production claim.

The machine-readable source of truth is `release/readiness.json`. Run:

`pnpm verify:readiness`

For the commercial lane, run:

`pnpm verify:readiness -- --mode commercial`

## Current state

The current merged release train has strong L2 evidence across the core architecture, queue/policy execution, research intelligence, Universal Search, Publishing Workbench, Competitive Watch, deterministic link intelligence core, platform foundation, content reuse policy, evidence-backed reporting packs, workspace isolation, native desktop/mobile validation, web quality, release-readiness validation, and exact-SHA soak/provenance hardening.

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
- Controlled real connector evidence captured with the owner-authorized proof harness;
- production rollback drill;
- desktop signing/notarization;
- Android/iOS production signing and store distribution;
- GitHub protected-main policy is active with required `ci` and `security:scan` contexts; the current integration cannot inspect administrative ruleset details, and final release-L3 governance evidence remains a separate gate.
- commercial payment/billing activation;
- final legal/commercial publication review.

## Web production evidence

The canonical Vercel site is live and the current seven-day grouped runtime-error query is clean. Public verification confirms the current web surface is the intended Next.js/RTL/PWA surface with working pricing/legal routes, manifest, service worker, security headers and real 404 behavior. The repository deployment contract is a Next.js static export under `packages/web/out`. Guarded deployments fail closed if release credentials are missing and, when credentials exist, verify the embedded release SHA through `/api/health.json` and `/api/release.json`.

The public production alias is healthy infrastructure but is not accepted as current-main provenance because the provenance JSON endpoints are not yet exposed on the canonical alias and the guarded current-main deployment lane is blocked at the missing-credentials gate.

## Distribution posture

Desktop artifacts are technically buildable on Windows/Linux/macOS architectures and the validation workflow generates checksums. Current releases remain validation/prerelease artifacts and are not commercial signed distribution.

Mobile validation is passing, but production signing/store distribution remains a separate gate.

## Safety boundary

ORBIT intentionally excludes CAPTCHA bypass, fingerprint spoofing, anti-abuse evasion, concealed automation, and unauthorized bulk messaging. External execution remains user-authorized, policy-governed, bounded, and auditable.
