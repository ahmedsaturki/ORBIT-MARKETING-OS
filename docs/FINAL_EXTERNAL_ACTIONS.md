# ORBIT — Final External Actions

Updated: 2026-09-28.

The merged core is strongly verified at L2 across the main product domains. Current-main web production provenance is verified through the current Vercel deployment, governed provenance workflow, and live health/release readback. The remaining actions below require real platform accounts, provider credentials, signing identities, physical/store infrastructure, elapsed-time evidence, or a human-controlled commercial decision.

## A. Vercel

Current-main production deployment and provenance are verified through Vercel Production Provenance run 36434671316, Web Deploy run 36434671320, and deployment dpl_CVTi4TwkUUntjsCrNonMwVJT32qm.
- The current production deployment and public provenance endpoints were live-read at 2026-09-28T14:17Z and reported the same exact release SHA as the governed Vercel verification.

- repository/main: the current repository SHA is verified by the live governed provenance readback;
- project: `orbit-marketing-os`;
- framework: Next.js;
- source: Git;
- target: production;
- canonical alias: `orbit-marketing-os.vercel.app`;
- public health/release provenance checks, security headers, route behavior, manifest/service worker, and 404 checks pass.

The remaining Vercel action is only:

1. Exercise rollback from the current verified production deployment to the previous verified candidate and back.
2. Preserve exact rollback evidence tied to deployment IDs and release SHA.

## B. Real connector verification

Perform controlled user-authorized tests for:

- Telegram authorization + one controlled delivery;
- LinkedIn authorization + one controlled publish;
- challenge/manual-intervention behavior;
- failure/retry/recovery;
- audit record verification.

No bypass, stealth, anti-ban, or unauthorized bulk automation is part of the acceptance criteria.

## C. Native / sync / accessibility / stability

- Automated restart/recovery/migration evidence is consolidated and passed 4/4 on the later exact main SHA `367c0de11cd7c075ff59448cb7dafdfaf98faffa` (CI run `36425376303`; artifact `10971258468`).
- Complete the remaining forced-crash/field recovery evidence and consolidate any real-world recovery observations.
- Run live multi-device CRDT convergence using real authorized devices/network.
- Complete manual WCAG/RTL audit in addition to automated checks.
- Complete a 24-hour stability soak on the approved exact main ref.

## D. Distribution

- Produce signed/notarized desktop installers when signing identities are available.
- Produce production-signed Android/iOS packages and complete store submission/distribution.
- Perform the final release-tag checksum/provenance drill.

## E. Governance / commercial

- Preserve final L3 governance evidence for the protected-main policy and exact verification timestamps/evidence references.
- Configure actual payment/billing and verify checkout/refund behavior.
- Perform final legal/commercial publication review.
- Resolve the current-main SonarCloud requirement: Security Rating on New Code must reach A.

## Release rule

Commercial Production Proven means every release-critical item has L3 evidence. Do not infer L3 from source presence, a live deployment, a green CI run, or a prior release artifact alone.
