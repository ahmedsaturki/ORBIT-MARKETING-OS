# ORBIT Commercial Production Proven — Release Runbook

Updated: 2026-09-29.

## Release rule

ORBIT is commercially production-proven only when every release-critical gate is L3_PRODUCTION_PROVEN.

Readiness levels:

- L0_DESIGNED
- L1_IMPLEMENTED
- L2_VERIFIED
- L3_PRODUCTION_PROVEN

Acceptance chain:

SPEC → IMPLEMENT → UNIT TEST → INTEGRATION → E2E → SECURITY → PERFORMANCE → RECOVERY → REAL-WORLD EVIDENCE → DOCUMENTATION → RELEASE

## Evidence classes

### A. Repository evidence

- Exact Git SHA.
- Signed release commit/tag.
- Exact-head CI and native/mobile validation.
- Release Evidence Bundle artifact + SHA-256 digest.
- Security/quality/performance reports.

### B. Runtime evidence

- Desktop restart/migration/crash recovery.
- Queue recovery and replay/resume.
- 24-hour stability soak.
- No unexplained runtime errors during the verification window.

### C. External integration evidence

- User-authorized Telegram test account.
- User-authorized LinkedIn test account.
- Controlled publish/readback evidence.
- Explicit connector capability and policy result.
- No bypass of platform controls.

### D. Distribution evidence

- Windows/Linux/macOS artifacts.
- SHA-256 manifest.
- Desktop signing/notarization.
- Android/iOS production signing.
- Store/package distribution evidence.

### E. Web production evidence

- Canonical production deployment.
- Git SHA embedded in /api/health.json and /api/release.json.
- HTTPS/security headers.
- 404 behavior.
- RTL smoke.
- Rollback to previous verified deployment.

### F. Governance and commercial evidence

- GitHub main branch protection/rulesets.
- Required status checks.
- Secrets policy.
- Billing/payment activation, if monetization is enabled.
- Final terms/privacy/refund/EULA publication review.

## Current verified state — 2026-09-28

- The latest independently verified production release cycle has successful CI/security/Rust evidence plus Vercel Production Provenance and Web Deploy verification on its historical production SHA `edc8c07f0527c7ea9b38827e293fd820b9f6cce0`; the current main verification cycle is separately tracked by exact-main CI run `36496595601` and is not a production release.
- The latest verified production deployment is `dpl_3YiUkYHNpQPRaPjTZvH5UrTztEQp`: source=`git`, framework=`nextjs`, target=`production`, canonical `orbit-marketing-os.vercel.app` alias, and public exact-SHA provenance endpoints are verified. Current main remains outside production until a reviewed non-bootstrap marker is selected and proven.
- GitHub `main` is protected with required `ci` and `security:scan` checks.
- Exact SHA, deployment ID, workflow run IDs, and artifact digests are retained in per-release evidence and should not be hard-coded into this durable runbook.
- Universal Search previously failed Windows Native E2E because of a real SQLite LIKE escaping defect; the defect has been fixed and literal `%`, `_`, and `!` regression coverage added.
- PR #124 consolidated bounded Windows Native E2E staging, LinkedIn ambiguous-delivery fail-closed semantics, and governed Vercel Git provenance. Its exact-head Windows Native E2E and four desktop packaging targets passed before merge.
- Commercial production is still not proven: the 24-hour soak, rollback drill, real Telegram/LinkedIn evidence, multi-device CRDT network proof, manual accessibility audit, signing/store distribution, final L3 governance evidence, billing activation, legal/commercial review, and the current-main Sonar A requirement remain open.

## Current hardening note

The release-proof lane is fail-closed: readiness cannot declare L3 without auditable evidence references and verification time, connector proof requires durable per-platform delivery evidence with external IDs, and the Vercel lane requires exact release-SHA verification before promotion.

## Gates that cannot be fabricated

Some L3 gates require owner-controlled external evidence and therefore cannot be satisfied by source changes alone:

- live Telegram authorization and controlled delivery;
- live LinkedIn authorization and controlled publishing;
- real multi-device CRDT network operation;
- manual WCAG/RTL audit;
- 24-hour elapsed soak evidence;
- desktop signing/notarization certificates or equivalent release credentials;
- production mobile signing/store distribution credentials;
- A Vercel credential-backed prebuilt deployment is optional while the governed main-only Git provenance path remains healthy;
- Final L3 governance evidence for protected-main policy;
- payment/billing provider activation;
- final legal/commercial approval.

These remain explicit release blockers until verified.

## Zero-cost engineering policy

All repository changes and automated verification should remain dependency-light and free of new paid services where technically possible. This does not mean external commercial platform prerequisites can be invented or bypassed.

## Release freeze rule

Do not promote an artifact to commercial release merely because build, UI, or unit tests pass. Promotion requires the complete gate matrix, exact artifact provenance, real-world evidence, recovery proof, distribution proof, governance proof, and final commercial/legal sign-off.

## Operator sequence

1. Freeze the exact release SHA.
2. Run readiness, security, performance, CI, native, mobile, and web gates.
3. Generate and retain the exact-ref Release Evidence Bundle.
4. Execute controlled real connector tests.
5. Execute recovery and 24-hour stability evidence.
6. Produce signed distribution artifacts.
7. Deploy the exact release SHA to canonical production.
8. Verify live SHA, health, security, routes, and rollback.
9. Verify governance/commercial/legal controls.
10. Promote only after every release-critical gate reads L3.

## Evidence retention

Retain:

- exact SHA;
- workflow run IDs;
- artifact IDs/digests;
- deployment ID;
- environment and configuration identifiers without exposing secrets;
- test account identifiers without exposing credentials;
- rollback evidence;
- final release decision record.
