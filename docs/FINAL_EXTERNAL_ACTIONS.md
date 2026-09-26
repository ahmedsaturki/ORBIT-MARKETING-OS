# ORBIT — Final External Actions

Updated: 2026-09-26

The merged core is now strongly verified at L2 across the main product domains. The remaining actions below require provider credentials, real platform accounts, signing identities, physical/store infrastructure, or a human-controlled commercial decision.

## A. Vercel

1. Confirm the connected Vercel Project Settings match the repository contract: repository root, Next.js, Node 22.x, build `pnpm --dir packages/web build`, output `packages/web/out`.
2. Provide the Vercel deployment credentials to the guarded GitHub release environment.
3. Produce a current-main prebuilt production deployment with `NEXT_PUBLIC_ORBIT_RELEASE_SHA=377e86d...` and retain the live verification output.
4. Exercise rollback to the previous verified production deployment and retain evidence.

PR #76 now makes missing credentials a hard gate instead of a soft-disable.

## B. Real connector verification

Perform controlled user-authorized tests for:

- Telegram authorization + one controlled delivery;
- LinkedIn authorization + one controlled publish;
- challenge/manual-intervention behavior;
- failure/retry/recovery;
- audit record verification.

No bypass, stealth, anti-ban or unauthorized bulk automation is part of the acceptance criteria.

## C. Native / sync / accessibility

- Run the full restart/migration/crash-recovery acceptance and consolidate evidence.
- Run live multi-device CRDT convergence using real authorized devices/network.
- Complete manual WCAG/RTL audit in addition to automated checks.
- Complete 24-hour stability soak on the approved main ref.

## D. Distribution

- Produce signed/notarized desktop installers when signing identities are available.
- Produce production-signed Android/iOS packages and complete store submission/distribution.
- Perform the final release-tag checksum/provenance drill.

## E. Governance / commercial

- Enable and verify GitHub main branch protection/rulesets with required CI/native checks.
- Configure actual payment/billing and verify checkout/refund behavior.
- Perform final legal/commercial publication review.

## Release rule

Commercial Production Proven means every release-critical item has L3 evidence. Do not infer L3 from source presence, a live old deployment, or a green CI run alone.
