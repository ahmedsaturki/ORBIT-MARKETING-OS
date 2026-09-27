# ORBIT Commercial Production Proven — Release Runbook

Updated: 2026-09-27.

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
- Git SHA embedded in /api/health and /api/release.
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

## Current verified state — 2026-09-27

- Exact-main Release Evidence Bundle succeeded on main run `36282263357` at SHA `33e29a0f99411c7285abb5a8dbf823fcf60d0f52`.
- The evidence artifact ID is `10918938828` and its digest is `sha256:7a80db78afa218c26df225e840bc81a27fb422b82958ed55511a27cb10d4ad55`.
- Main Web Deploy reached the Web quality gate, but the Vercel credential gate failed closed and deployment was skipped.
- Current Vercel production deployment is READY but has empty Git provenance metadata.
- Universal Search previously failed Windows Native E2E because of a real SQLite LIKE escaping defect; the defect has been fixed and literal `%`, `_`, and `!` regression coverage added.
- Link Intelligence previously failed Windows Native E2E because the test payload shape did not match the native IPC contract; the test has been corrected and a fresh exact-head validation cycle is running.

## Gates that cannot be fabricated

Some L3 gates require owner-controlled external evidence and therefore cannot be satisfied by source changes alone:

- live Telegram authorization and controlled delivery;
- live LinkedIn authorization and controlled publishing;
- real multi-device CRDT network operation;
- manual WCAG/RTL audit;
- 24-hour elapsed soak evidence;
- desktop signing/notarization certificates or equivalent release credentials;
- production mobile signing/store distribution credentials;
- Vercel release credentials for the guarded prebuilt deployment;
- GitHub administrator action for branch protection/rulesets;
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
