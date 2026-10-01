# ORBIT — Final External Actions

Updated: 2026-10-01.

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

## F. Snyk account quota

The Snyk check `security/snyk (ahmedsaturki)` is in state `ERROR` (not `fail`) with the message "You have used your limit of private tests" (observed 2026-09-30, createdAt `2026-09-30T23:43:12Z`). It is an external commit StatusContext targeting app.snyk.io, NOT a GitHub Actions run, so it has NO Actions log and NO GitHub "re-run" path. This is an Snyk account/billing quota limit (zero tests executed), NOT a code defect, NOT a vulnerability finding, and NOT agent-fixable. When observed on head `ead1a942` the status was re-created with a fresh StatusContext id, so that was a genuine fresh result for that commit, not a cached status; this says nothing about whatever the PR head is now. It requires the owner's Snyk account or billing action.

As observed on 2026-09-30, PR #171 reported `mergeStateStatus: UNSTABLE` on GitHub due to this check; that is a dated observation, not a live status claim. Branch protection on `main` requires exactly `["ci", "security:scan"]` and BOTH PASS as of that observation. `required_pull_request_reviews` is not configured, `reviewDecision` is empty, and `enforceAdmins` is `true`. Therefore GitHub does NOT block the merge on this check. Refusing to merge over it is a deliberate policy decision under the ORBIT contract (never merge over a failing security check), not a GitHub-enforced protection rule. State this plainly so the owner does not wait on a rule that does not exist.

Owner options:

- Resolve or upgrade the Snyk account/billing plan.
- Once quota is restored, re-trigger the Snyk check via Snyk's own controls (e.g. re-request the check from the Snyk app) or push a new commit — the status re-fires automatically on each new commit. Re-running the GitHub Actions `security:scan` job does NOT affect this check.
- Retire or supersede the Snyk integration ONLY if you first establish replacement dependency-CVE coverage elsewhere. The in-repo `security:scan` gate is NOT that replacement: it checks tracked files for committed secrets, dangerous extensions, and stray `.env` files, and performs no dependency or container vulnerability analysis. Retiring Snyk without equivalent dependency-CVE coverage would leave dependency scanning absent, not "fully covered" — decide that trade-off explicitly and record it.
- Do NOT expect changing branch-protection required checks to unblock anything: `security/snyk` is not a required check, so removing it from required checks has no effect on this failure.

Evidence: as observed on 2026-10-01, PR #171's `ci` and `security:scan` checks passed on head `ead1a9420faadf2f4f2061073ffc53751e8d26ef` in run `36792517476`, while `security/snyk` reported `ERROR` on the account quota above. The serving Production deployment remains 9ba07318 and is unrelated to this branch. This entry is a dated observation, not a live status claim; the PR head advances independently and `ead1a942` is cited only as historical exact-SHA evidence.

## Release rule

Commercial Production Proven means every release-critical item has L3 evidence. Do not infer L3 from source presence, a live deployment, a green CI run, or a prior release artifact alone.
