# ORBIT — Final External Actions

Updated: 2026-10-03.

The merged core is strongly verified at L2 across the main product domains. The canonical Production alias is live and currently serves a READY Git deployment `dpl_9KyEbWzvAYvhvzZPmtXNJXrP16xV` on `9ba07318f4d580e670be9d27ec76888e66013340`; public version and provenance checks are passing. The current `main` branch contains the release-truth/documentation reconciliation and live-production observation verifier; its exact moving SHA is intentionally maintained by run-bound evidence rather than hard-coded here. Its ordinary Vercel deployment is not counted as the serving Production deployment. The remaining actions below require real platform accounts, provider credentials, signing identities, physical/store infrastructure, elapsed-time evidence, or a human-controlled commercial decision.

## A. Vercel

Production deployment is controlled by the reviewed `release/PRODUCTION_RELEASE.json` marker.

- Ordinary `main` commits do not become Production deployments merely because web or release documentation changed.
- A non-bootstrap marker update on `main` identifies the exact release commit.
- The Vercel deployment/provenance workflow verifies the public deployment against that marker commit SHA.
- The release observation contract records the live Production deployment separately from moving `main`, and CI can fail closed when the live public identity drifts from that committed observation.
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

## F. node-forge GHSA-86w9-cpqp-85rv — HIGH, no upstream release

- CVSS 3.1 7.5, CWE-347 (improper verification of cryptographic signature)
- Vulnerable: node-forge <= 1.4.0. Fixed: none. 1.4.0 is the latest release.
  (also @expo/code-signing-certificates@0.0.6 > node-forge@1.4.0)
- Reachability: build/dev only. @expo/code-signing-certificates is part of the
  Expo EAS build/signing toolchain; no runtime, web, or desktop artifact
  references node-forge. The vulnerable RSA PKCS#1 v1.5 verification path is not
  reached by that package, which only performs signing operations.
- Why `pnpm audit` stays red: pnpm audit matches the DECLARED version. The patch
  in patches/node-forge@1.4.0.patch fixes the code in place but does not change
  the resolved version, so the finding persists by design. The advisory was
  updated 2026-10-01T21:09:10Z, after the last green main run (2026-09-30), so any
  fresh `ci` run fails.
- Proposed upstream fix: digitalbazaar/forge#1152 is OPEN and unmerged, with one
  approval from a non-maintainer contributor. It is NOT maintainer-endorsed and
  NOT merged. Review patches/node-forge@1.4.0.patch before relying on it.
- Regression proof: packages/mobile/test/nodeForgeDigestInfo.test.ts drives the
  upstream PoC vectors and asserts a forged PKCS#1 v1.5 signature is rejected;
  the test fails if the patch is removed.

OWNER_ACTION: decide whether to (a) accept a red `ci` dependency-audit step until
node-forge ships a release, or (b) record an explicit, scoped, reviewable
exception referencing this advisory. Do not silently suppress it.
`pnpm audit --audit-level=moderate` reports one HIGH finding that cannot be
cleared by any available dependency update.

- Advisory: GHSA-86w9-cpqp-85rv / CVE-2026-85393, <https://github.com/advisories/GHSA-86w9-cpqp-85rv>. CVSS v4 8.7, CWE-347.

Commercial Production Proven means every release-critical item has L3 evidence. Do not infer L3 from source presence, a live deployment, a green CI run, or a prior release artifact alone.

## Upstream verification note — 2026-10-03

`digitalbazaar/forge#1152` is the upstream PR that implements the same nested `DigestAlgorithm` element-count fix. It remains open/unmerged; its diff explicitly adds the nested element-count check and a regression test. ORBIT therefore keeps the backport as a local patch rather than waiting for a published upstream version.
