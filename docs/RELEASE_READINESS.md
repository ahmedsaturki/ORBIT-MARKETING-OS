# ORBIT Marketing OS — Release Readiness

Updated: 2026-09-26

## Canonical repository state

- Current `main`: `1cb104647bc69cff114f430cab1ff9dc184ed864`
- - PR #71 latest release-truth head: `5518e4489b90bf8f5c4050f44f114f9ab1877b86`
- PR #72 latest Publishing Workbench / Competitive Watch lineage is tracked separately.

## Product baseline

ORBIT is being developed as a private, local-first Marketing Operating System rather than a standalone scheduler. The architecture centers one governed marketing graph across strategy, campaigns, content, approvals, execution, conversations, CRM, outcomes, analytics, research, knowledge, agents, and learning.

## Verification model

A capability is not considered complete from source inspection alone. Release evidence follows:

SPEC → IMPLEMENT → UNIT TEST → INTEGRATION → E2E → SECURITY → PERFORMANCE → RECOVERY → REAL-WORLD EVIDENCE → DOCUMENTATION → RELEASE

Readiness levels:

- L0 Designed
- L1 Implemented
- L2 Verified
- L3 Production Proven

Commercial production readiness requires L3 evidence for all release-critical capabilities.

## Verified / strongly evidenced

- Core TypeScript/Rust architecture and local SQLite runtime.
- React/ReactDOM are pinned at 19.2.8 across the release workspaces; mobile transitive advisories for `uuid` and `decode-uri-component` are mitigated in the lockfile via scoped pnpm overrides.
- Workspace isolation and role-gated sensitive commands.
- Queue/policy execution, retry, replay, simulation, audit, research intelligence, search, campaigns, CRM, content, media, agents, analytics and sync domains.
- Web package is Next.js 16.3.6 static export.
- Live Vercel web surface serves the rebuilt Next.js application with RTL Arabic UI.
- Live public routes, manifest, service worker, security headers and 404 behavior have been checked.
- Windows Native E2E exposed and drove a real Universal Search SQL escaping fix.
- Bulk Planner logic is now extracted into a core pure function with bounded inputs and unit coverage.
- Competitive Watch is workspace-namespaced and stores public source locators only.

## Active release validation

Fresh CI, Desktop Native Validation, and Mobile Validation runs are executed from the latest release-line heads. A run is only accepted after terminal success on the exact head under review.

## Production blockers

- real Telegram authorization/delivery;
- real LinkedIn authorization/publishing;
- live multi-device CRDT network verification;
- native restart/migration/crash-recovery evidence consolidation;
- manual accessibility/WCAG/RTL audit;
- 24-hour stability soak;
- release-tag checksum/provenance drill;
- desktop signing/notarization;
- production Android/iOS signing and store distribution;
- Vercel Project Settings reconciliation;
- guarded Vercel production deployment with embedded Git SHA verification;
- production rollback drill;
- GitHub main branch protection/ruleset verification;
- commercial payment/billing;
- final legal/commercial publication review.

## Distribution posture

- Desktop: technically buildable; unsigned distribution is not commercial signing evidence.
- Mobile: debug validation artifact exists; store signing/distribution is separate.
- Web: live production surface exists; current public deployment is not treated as release-proven until project settings and embedded SHA provenance are verified.

## Safety boundary

ORBIT deliberately excludes fingerprint spoofing, CAPTCHA bypass, anti-abuse evasion, concealed automation, and unauthorized bulk messaging. External execution remains user-authorized, policy-governed, bounded and auditable.
