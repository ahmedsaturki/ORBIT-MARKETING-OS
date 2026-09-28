# ORBIT Marketing OS — Release Readiness

Updated: 2026-09-28.

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
- PR #124: merged — consolidated Windows Native E2E, LinkedIn ambiguous-delivery, and governed Vercel provenance hardening.
- PR #125: merged — current production provenance and gate reconciliation.
- PR #126: merged — exact provenance deployment hardening.
- PR #127: merged — durable SHA-independent release truth.
- PR #128: merged — durable external-action and implementation-status reconciliation.
- PR #129: merged — repository-root-safe Vercel Ignore Build Step handling and nested-root regression coverage.
- PR #132: merged — OMP-native project context, sticky rules, watchdog/advisor roster, operator agents, release triage and evidence/performance controls.
- PR #136: merged — exact-SHA recovery/migration evidence harness and durable recovery artifact.

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

The current merged release train has strong L2 evidence across the core architecture, queue/policy execution, research intelligence, Universal Search, Publishing Workbench, Competitive Watch, deterministic link intelligence core, platform foundation, content reuse policy, evidence-backed reporting packs, workspace isolation, native desktop/mobile validation, web quality, release-readiness validation, and exact-SHA soak/provenance hardening. Exact release SHA, deployment, workflow-run, and artifact identifiers are deliberately recorded in per-release evidence bundles and operational issue reconciliations rather than hard-coded into this durable policy document.

A Windows Native E2E run previously found a real SQLite LIKE-escaping defect in Universal Search. The defect was fixed and the corrected feature head subsequently passed CI, desktop native, mobile, and Windows Native E2E.

## Production gates still open

- real Telegram authorization and controlled delivery;
- real LinkedIn authorization and controlled publishing;
- live multi-device CRDT verification;
- dedicated restart/migration/crash recovery evidence consolidation; automated 4/4 recovery/migration proof is now complete, while forced-crash/field recovery evidence remains open;
- manual WCAG/RTL audit;
- 24-hour stability soak;
- controlled real connector evidence captured with the owner-authorized proof harness;
- production rollback drill;
- desktop signing/notarization;
- Android/iOS production signing and store distribution;
- final L3 governance evidence for protected-main policy;
- commercial payment/billing activation;
- final legal/commercial publication review;
- current successful latest-main SonarCloud analysis meeting the required A Security Rating on New Code.

## Web production evidence

The canonical Vercel project is live on the governed Git deployment path. The release contract requires each current-main production deployment to be sourced from Git `main`, use the `nextjs` framework, expose the canonical `orbit-marketing-os.vercel.app` alias, and prove the exact Git SHA through `/api/health.json`, `/api/release.json`, homepage provenance, security headers, routes, manifest/service worker, and 404 checks.

The latest verified production cycle passed the Vercel Git provenance workflow, full Web Deploy workflow, release-evidence workflow, and live surface checks for the current `main` release. The verified deployment is Git-sourced, targets production, uses the Next.js framework, serves the canonical `orbit-marketing-os.vercel.app` alias, and exposes exact release provenance through `/api/health.json`, `/api/release.json`, and the homepage. The remaining Vercel release action is the controlled rollback drill to the previous verified candidate and back.

## Distribution posture

Desktop artifacts are technically buildable on Windows/Linux/macOS architectures and the validation workflow generates checksums. Current releases remain validation/prerelease artifacts and are not commercial signed distribution.

Mobile validation is passing, but production signing/store distribution remains a separate gate.

## Safety boundary

ORBIT intentionally excludes CAPTCHA bypass, fingerprint spoofing, anti-abuse evasion, concealed automation, and unauthorized bulk messaging. External execution remains user-authorized, policy-governed, bounded, and auditable.
