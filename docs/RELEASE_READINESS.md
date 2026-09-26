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
- PR #88: merged — encrypted sync-network convergence proof.
- PR #89: merged — auditable release evidence bundle.
- PR #93: merged — automatic exact-main release evidence.
- PR #94: merged — release evidence collector defaults safely to verification mode.
- PR #87: open — Link Intelligence persistence/evidence; exact-head native regression is being repaired.
- PR #95: open — regional competitor-watch expansion on current main.

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

The current merged release train has strong L2 evidence across the core architecture, queue/policy execution, research intelligence, Universal Search, Publishing Workbench, Competitive Watch, deterministic link intelligence core, platform foundation, content reuse policy, evidence-backed reporting packs, workspace isolation, native desktop/mobile validation, and web quality.

A Windows Native E2E run found a real SQLite LIKE-escaping defect in Universal Search. The defect was fixed on the current release lines and a literal-wildcard regression was added. Current exact-head verification is rerunning.

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

The connected Vercel project is live and the current seven-day grouped runtime-error query is clean. Guarded deployments now fail closed if release credentials are missing and, when credentials exist, verify the embedded release SHA through /api/health and /api/release.

The latest production deployment is READY but exposes empty Git metadata in the connected deployment API. It is therefore healthy live infrastructure, not yet canonical release provenance.

The Release Evidence Bundle now succeeds automatically on the exact pushed `main` ref. Run `36280911514` produced the current exact-head evidence artifact for `20e05751dee23fbeeed4049f041dc9f66e2548a0`.

## Distribution posture

Desktop artifacts are technically buildable on Windows/Linux/macOS architectures and the validation workflow generates checksums. Current releases remain validation/prerelease artifacts and are not commercial signed distribution.

Mobile validation is passing, but production signing/store distribution remains a separate gate.

## Safety boundary

ORBIT intentionally excludes CAPTCHA bypass, fingerprint spoofing, anti-abuse evasion, concealed automation, and unauthorized bulk messaging. External execution remains user-authorized, policy-governed, bounded, and auditable.
