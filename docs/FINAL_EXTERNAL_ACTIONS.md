# ORBIT — Final External Actions

Updated: 2026-10-02.

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

As observed on 2026-09-30, PR #171 reported `mergeStateStatus: UNSTABLE` on GitHub due to this check; that is a dated observation, not a live status claim. The configuration statements in the 2026-09-30 observation are SUPERSEDED by the 2026-10-02 observation recorded below and must not be read as current truth. What the 2026-10-02 live check confirms: required status checks on `main` are exactly `["ci", "security:scan"]` and `enforceAdmins` is `true`. The review requirement is NOT settled by that check, and the prior claim that `required_pull_request_reviews` "is not configured" is withdrawn as unverifiable: the parent protection payload omits `required_pull_request_reviews` entirely and GraphQL reports `requiresApprovingReviews: false` with no repository rulesets defined, while the `required_pull_request_reviews` sub-resource still reports `required_approving_review_count: 1`. Those sources conflict, so this document asserts no current required-review count in either direction; re-verify before relying on it. Independently confirmed: `security/snyk` is not among the required checks, so a Snyk failure by itself is not a GitHub-enforced block — PR #171 was `UNSTABLE`, not `BLOCKED`, with both required checks passing. Refusing to merge over a failing security check remains a deliberate policy decision under the ORBIT contract (never merge over a failing security check), and that decision stands on its own regardless of whether GitHub enforces it.

Owner options:

- Resolve or upgrade the Snyk account/billing plan.
- Once quota is restored, re-trigger the Snyk check via Snyk's own controls (e.g. re-request the check from the Snyk app) or push a new commit — the status re-fires automatically on each new commit. Re-running the GitHub Actions `security:scan` job does NOT affect this check.
- Retire or supersede the Snyk integration ONLY if you first establish replacement dependency-CVE coverage elsewhere. The in-repo `security:scan` gate is NOT that replacement: it checks tracked files for committed secrets, dangerous extensions, and stray `.env` files, and performs no dependency or container vulnerability analysis. Retiring Snyk without equivalent dependency-CVE coverage would leave dependency scanning absent, not "fully covered" — decide that trade-off explicitly and record it.
- Do NOT expect changing branch-protection required checks to unblock anything: `security/snyk` is not a required check, so removing it from required checks has no effect on this failure.

Evidence: as observed on 2026-10-01, PR #171's `ci` and `security:scan` checks passed on head `ead1a9420faadf2f4f2061073ffc53751e8d26ef` in run `36792517476`, while `security/snyk` reported `ERROR` on the account quota above. The serving Production deployment remains 9ba07318 and is unrelated to this branch. This entry is a dated observation, not a live status claim; the PR head advances independently and `ead1a942` is cited only as historical exact-SHA evidence.

Evidence (fresh observation, not a carry-over): PR #171 on head `1c47fc98` (exact `1c47fc98503125626c65999538421b86220927b4`), run `36808382310`, observed 2026-10-01, passed `ci`, `security:scan` and `Rust quality`, while `security/snyk (ahmedsaturki)` again reported state `ERROR` with the same quota message "You have used your limit of private tests" — this time under a distinct StatusContext id `55327446652` (target url `.../pr-checks/cf53741d-66db-422e-b53a-db38d5bf20e3`, `created_at` 2026-10-01T02:59:12Z), different from the id recorded for the `ead1a942` observation above. The new id confirms the status was re-created for this commit rather than reused from the earlier head. This entry is a dated observation, not a live status claim; the PR head advances independently and `1c47fc98` is cited only as historical exact-SHA evidence.

Evidence (dated observation, third recorded instance): PR #171 on head `bbfa1dfcdb35057d01c9cf3f1ffb08c5721fae99`, CI run `36816942017`, observed 2026-10-01, passed `ci`, `security:scan` and `Rust quality`, while `security/snyk (ahmedsaturki)` again reported state `ERROR` with the same quota message "You have used your limit of private tests" under the Snyk PR-check identifier `e0902067-955c-40c6-bc15-ce6758d1db39` taken from the `target_url` path segment `https://app.snyk.io/org/ahmedsaturki/pr-checks/e0902067-955c-40c6-bc15-ce6758d1db39` (GitHub status id `55331962629`), `createdAt` 2026-10-01T04:50:09Z. Every head observed on this branch produces its own distinct ERROR context with zero tests executed, which is consistent with an account-wide private-test quota exhaustion rather than a per-commit defect; the count of instances is unbounded and deliberately not enumerated here. `bbfa1dfc` is cited as historical exact-SHA evidence, not as the current PR head.

Evidence (dated observation, 2026-10-02, supersedes the review claim in the paragraph above): live `main` branch protection required status checks are exactly `["ci", "security:scan"]` (`strict: false`) and `enforce_admins.enabled` is `true`. The prior statement that `required_pull_request_reviews` is not configured could NOT be reconfirmed and is superseded by this observation: `GET /branches/main/protection` returns no `required_pull_request_reviews` key at all, GraphQL `branchProtectionRule.requiresApprovingReviews` is `false`, and the repository rulesets list is empty (`[]`), yet `GET /branches/main/protection/required_pull_request_reviews` returns HTTP 200 with `required_approving_review_count: 1` (`dismiss_stale_reviews: false`, `require_code_owner_reviews: false`, `require_last_push_approval: false`). The disagreement between the effective rule and that sub-resource is recorded rather than resolved; treat the required-review count as unconfirmed in both directions rather than as a known blocker. PR states at the same observation: PR #171 `mergeStateStatus: UNSTABLE` on head `efdcf9fae75f4a2adffa9a9669c4ad8672d85a6f` with `ci` and `security:scan` passing and only `security/snyk` failing, confirming again that a Snyk failure alone does not produce a GitHub-enforced block; PR #177 `mergeStateStatus: BLOCKED` on head `5ef56bb0f4a32f2e13e1f1aeb3dd63a774ee28fb` and PR #178 `mergeStateStatus: BLOCKED` on head `d02c2661479dbbd3ede0db849d449083318c083c`, both blocked on the REQUIRED `ci` check failing (in both cases `security:scan` passed), not on review approval. All three PRs report `reviewDecision` empty, with only `COMMENTED` bot reviews present and no `APPROVED` review on any of them; had one approving review been actively required, GitHub would have reported `REVIEW_REQUIRED` and PR #171 would not have been merely `UNSTABLE`. This entry is a dated observation, not a live status claim or a permanent statement about branch protection; PR heads advance independently and the cited SHAs are historical exact-SHA evidence only.

## Release rule

Commercial Production Proven means every release-critical item has L3 evidence. Do not infer L3 from source presence, a live deployment, a green CI run, or a prior release artifact alone.
