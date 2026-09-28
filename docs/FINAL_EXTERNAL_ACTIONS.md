# ORBIT — Final External Actions

Updated: 2026-09-28.

The merged core is strongly verified at L2 across the main product domains. The last independently verified Vercel production deployment remains a READY Git deployment from a prior verified release SHA; the current main is not treated as production-proven until an explicit production-release marker is deployed and its public provenance passes. The remaining actions below require real platform accounts, provider credentials, signing identities, physical/store infrastructure, elapsed-time evidence, or a human-controlled commercial decision.

## A. Vercel

Production deployment is controlled by the reviewed `release/PRODUCTION_RELEASE.json` marker.

- Ordinary `main` commits do not become Production deployments merely because web or release documentation changed.
- A non-bootstrap marker update on `main` identifies the exact release commit.
- The Vercel deployment/provenance workflow verifies the public deployment against that marker commit SHA.
- The zero-cost self-hosted release workflow uses the same marker and refuses to deploy an arbitrary moving `main`.
- Rollback remains a separate operation and is not claimed until both rollback and return-to-current are observed.

## B. Real connector verification

Perform controlled user-authorized tests for:

- Telegram authorization + one controlled delivery;
- LinkedIn authorization + one controlled publish;
- challenge/manual-intervention behavior;
- failure/retry/recovery;
- audit record verification.

No bypass, stealth, anti-ban, or unauthorized bulk automation is part of the acceptance criteria.

## C. Native / sync / accessibility / stability

- Automated restart/recovery/migration evidence is consolidated and passed on the validated release line.
- Complete the remaining forced-crash/field recovery evidence and consolidate any real-world recovery observations.
- Run live multi-device CRDT convergence using real authorized devices/network.
- Complete manual WCAG/RTL audit in addition to automated checks.
- Complete a 24-hour stability soak on the approved exact release ref.

## D. Distribution

- Produce signed/notarized desktop installers when signing identities are available.
- Produce production-signed Android/iOS packages and complete store submission/distribution.
- Perform the final release-tag checksum/provenance drill.

## E. Governance / commercial

- Preserve final L3 governance evidence for protected-main policy and exact verification timestamps/evidence references.
- Configure actual payment/billing and verify checkout/refund behavior.
- Perform final legal/commercial publication review.
- Resolve the current-main SonarCloud requirement: Security Rating on New Code must reach A.

## Release rule

Commercial Production Proven means every release-critical item has L3 evidence. Do not infer L3 from source presence, a live deployment, a green CI run, or a prior release artifact alone.
