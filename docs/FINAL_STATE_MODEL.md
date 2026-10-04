# ORBIT-MARKETING-OS — FINAL STATE MODEL

**Date:** 2026-10-04
**Verified commit:** `6027f026`
**Branch:** `audit/verification-2026-10` (merged to `main` at `698ea43f`)

This is the final deliverable of the re-audit. Every number below was produced
by running the command named beside it, not by reading a prior report.

---

## 1. Four-Part Status

| Dimension       | Status        | Basis                                                                                                                                                 |
| --------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Engineering** | **PASS**      | 379 JS tests (core 357, desktop 9, mobile 8, web 5), 182 Rust tests, typecheck 5/5, clippy `-D warnings` clean, fmt clean, all governance gates green |
| **Product**     | **PARTIAL**   | 77 of 83 requirements PASS. Three gaps are capability that was never built, not untested code                                                         |
| **Release**     | **NOT READY** | 0 of 13 release-critical gates at L3_PRODUCTION_PROVEN. The repository's own rule requires all 13                                                     |
| **Owner Gates** | **5 of 13**   | `external_connectors`, `accessibility`, `stability_soak`, `commercial_billing`, `legal_commercial`. Eight owner _actions_ remain, listed in section 7 |

All of the above is confirmed by CI, not by local execution alone. PR #213
reports 16 checks: 1 fails, 1 skips, the rest pass. The single failure,
`security/snyk`, is an external GitHub App reporting a billing limit rather than a
scan result — no workflow in this repository runs it, for the same reason
SonarCloud does not. `pnpm audit` independently reports 2 high advisories, both
governed by documented exceptions, and 0 unignored.

### Overall

> **NOT READY — READY WITH OWNER GATES**

**Read this section before acting on the rest of the document.** This audit ran
against a local `main` that had diverged from the remote: 40 commits ahead,
**13 behind**. Comparing against `origin/main` falsifies three claims made
earlier in this document.

| Earlier claim                                                             | Reality against `origin/main`                                                                                                                                                       |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm audit` was red in five workflows since 2026-09-25                   | **False.** `3978c0fc` (PR #200, 2026-10-03) already added the `GHSA-vfj7-8cjw-p6xm` ignore upstream. The gate was green; the governed exception added here duplicates existing work |
| `verify:workspace` was red repo-wide in eleven workflows since schema v17 | **False as stated.** The remote is at schema **v16** and its script correctly pins 16. Schema v17 exists only on this branch. The gate passes at `origin/main`                      |
| Three duplicate Rust test helpers broke the name-uniqueness gate          | **Not applicable upstream.** `origin/main` has none of those duplicates. The renames remain correct for this branch, which does have them                                           |

What survives, and is why this work still has value: the soak harness defects
are real and unfixed upstream. `origin/main:scripts/soak.ts` still takes
`taskForCycle(cycle: number)` with its own clock read, still records requested
minutes as elapsed, and has no bounded-run flag. The readiness
evidence-existence check, the user-guide contract, and the braces exception
contract are all absent from the remote (`origin/main` has no
`release-gate-model.test.mjs` at all).

One finding is narrower than stated: the conversation audit-workspace defect
exists only in this branch's refactor. Upstream never extracted a
`conversation_upsert_record` helper, so the mismatch between the function's
workspace argument and the global used for auditing could not arise there. The
fix is still correct for this branch.

**Resolved.** `origin/main` is merged in (`698ea43f`), not rebased. Eight
conflicts were resolved against checked facts rather than by preferring a
side. The schema pin reconciled cleanly at 17 on both sides, and the workspace
gate passes on the merged tree. Two conflicts turned out to be upstream
supersets and were taken wholesale; the soak and workspace conflicts were
additive and keep both sides. The acceptance matrix kept this branch's version
because all four disagreeing statuses were checked: `AI-01` stays PASS on a
test that runs green here, and `INBOX-01` stays PARTIAL because
`TelegramConnector.sync` returns `this.connect(context)` and `connect` only
validates credentials. Six governance gates, 379 JS tests, 182 Rust tests, and typecheck 5/5
pass on the result. See `RECONCILIATION.md` for the per-conflict record.

### Two script tests fail on this host, and CI proves they are not defects

`scripts/vercel-ignore.test.mjs` reports 2 failures when run locally
(`only the commit that changes the release marker can trigger a build`, and
`vercel ignore builds when the current commit has no parent`), both `0 !== 1`.
They fail identically at `d703fc88`, before any work in this branch, and the `ci`
job runs this file explicitly and passes.

The cause is the shell, not the script. `bash` resolves to
`C:\WINDOWS\system32\bash.exe` — the WSL launcher, which does not carry Windows
environment variables into the Linux namespace. So `VERCEL_GIT_COMMIT_REF` never
arrives, `vercel-ignore.sh` takes its "only the protected main branch may build"
path, and the test reads exit 0 where it expects 1. Git Bash
(`C:\Program Files\Git\bin\bash.exe`) receives the variable correctly, but node
resolves `bash` through Windows PATH and picks the WSL shim regardless of PATH
order.

The script's own root-commit handling is correct: it runs
`git rev-parse --verify HEAD^` and exits 1 when the parent cannot be established.
Nothing in the script or the test was changed to accommodate this host, because
the defect is in the environment and CI exercises the real one.

### Windows native E2E: 35 passed, 0 failed

The SEC-03 job failed at `d703fc88` on the positive control added for the
vacuous-assertion review finding:

```
the seeded session payload must actually be stored, or this test proves nothing
Expected: true
Received: false
34 passed (35.8s)
```

The cause was the call shape. `account_upsert` takes `session` and `password`,
seals them together and derives the stored blob; the test sent
`sessionPayloadJson`, `workspaceId` and `status`. Tauri ignores arguments a
command does not declare, so nothing threw — the account was written with a null
session and the control correctly reported the test could not prove its claim.
The sibling upserts already used the right shape, so this was the only affected
call site. The `secrettoken` leak check in the same test asserted against a field
`seal()` never produces; it now checks `ciphertext` and both seeded secrets.

Verified on the Windows native E2E job at `9d95c888`:

```
Windows native E2E  Run native and web E2E  35 passed (25.8s)
```

### PR #213 status: 16 checks, 1 failing

`ci`, `security:scan`, `Rust quality`, `SonarCloud Code Analysis`, `CodeFactor`,
`CodeRabbit`, `Android debug validation`, `Windows native E2E`, the four platform
builds (`linux-x64`, `macos-arm64`, `macos-x64`, `windows-x64`) and the three
Vercel checks pass. `Vulnerability analysis` (Debricked) skips.

`security/snyk` fails, and it is **not a check this repository can influence**.
Like SonarCloud, it comes from an external GitHub App rather than a workflow here:
the repository has 17 workflow files and none references Snyk. The check reports
`You have used your limit of private tests` in 0 seconds, which is a billing state
on the Snyk account, not a scan result.

It is therefore recorded as **not evaluated**, not as a passing security check.
The security claim that is actually verifiable is `pnpm audit`, which runs in
this repository: 2 high advisories, both governed by documented exceptions, 0
unignored. `security:scan` passes.

**The failing check does not block the merge.** `main` requires exactly two
status checks, `ci` and `security:scan`, and `strict` is `false`. Snyk is not
among them, so raising the plan or detaching the App is a reporting-hygiene
decision, not a merge gate. PR #213 reads `mergeable=MERGEABLE`;
`mergeStateStatus=BLOCKED` reflects the missing approving review, not Snyk.

---

## 2. Requirement Reconciliation

| Status     | Count  | Meaning                                              |
| ---------- | ------ | ---------------------------------------------------- |
| PASS       | 77     | Named evidence exists and executes                   |
| PARTIAL    | 3      | Some evidence exists; a required capability does not |
| UNVERIFIED | 3      | No executing evidence obtainable on this machine     |
| **FAIL**   | **0**  | —                                                    |
| **Total**  | **83** |                                                      |

The previous `REL-02` FAIL was reclassified to UNVERIFIED: the pipeline
deliberately builds unsigned and `docs/DISTRIBUTION.md` documents signing as an
owner-controlled gate. That is policy, not a defect in this repository.

### The three UNVERIFIED rows

| ID       | What is missing                 | Why it cannot be closed here                                          |
| -------- | ------------------------------- | --------------------------------------------------------------------- |
| `OPS-02` | The 24-hour soak run            | `stability-soak.yml` is `workflow_dispatch` on a `self-hosted` runner |
| `REL-03` | A tagged release with checksums | No tag exists; checksums require a real release build                 |
| `REL-02` | Signed, notarized artifacts     | Requires owner-controlled certificates                                |

### The three PARTIAL rows

| ID         | Evidence that exists                                   | What is still missing                                                 |
| ---------- | ------------------------------------------------------ | --------------------------------------------------------------------- |
| `INBOX-01` | Connector contracts, fixtures, challenge-stop behavior | No connector ingests conversations; `Connector.sync` is a placeholder |
| `DOC-01`   | Guide/env-var/loopback contract in CI                  | Prose and screenshots need human review                               |
| `DOC-02`   | Security exception register enforced by contract       | No executed human review of the threat model                          |

---

## 3. Defects Found and Fixed During This Audit

Each was proven load-bearing by reverting it and observing the failure.

| #   | Defect                                                                                                                                                                                            | Class                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1   | `soak.ts` recorded **requested** minutes as elapsed; a 1-minute run wrote `"minutes": 1440, "ok": true`                                                                                           | Verification asserting what it hadn't measured |
| 2   | Soak harness aborted at ~68 cycles on a claim-timestamp race                                                                                                                                      | Test-harness bug                               |
| 3   | `pnpm verify:workspace` failed repo-wide in **eleven** workflows since schema v17                                                                                                                 | Gate red since 2026-10-04                      |
| 4   | Readiness evidence could cite files that no longer exist                                                                                                                                          | Unenforced truth claim                         |
| 5   | `pnpm audit` exited 1 in **five** workflows since 2026-09-25                                                                                                                                      | Security gate red                              |
| 6   | `conversation_upsert` audited under the global workspace, not its argument                                                                                                                        | Cross-tenant audit write                       |
| 7   | Duplicate Rust test helpers (`upsert`, `grant`, `assert_unauthorized`) broke a name-uniqueness gate                                                                                               | Naming collision                               |
| 8   | Public web pages had no skip link (WCAG 2.4.1), so keyboard and screen-reader users had no bypass mechanism. **Fixed.** Sub-pages still lack banner/contentinfo landmarks (WCAG 1.3.1) — **open** | Accessibility                                  |

Two more were corrected in reporting rather than code: the workflow count was
understated as five (it is eleven), and a prior audit's counts now conflict with
the matrix, so it is marked superseded.

---

## 4. Gates That Were Red and Are Now Green

| Gate                                | Was                             | Now                                    |
| ----------------------------------- | ------------------------------- | -------------------------------------- |
| `pnpm verify:workspace`             | Failing repo-wide, 11 workflows | **PASS**                               |
| `pnpm audit --audit-level=moderate` | Exit 1, 5 workflows             | **PASS** (governed `braces` exception) |
| Schema version pins                 | Expected v16, code at v17       | **Pinned to 17**, proved to bite at 18 |

The `braces` advisory has no upstream patch. Its exception is governed by
`scripts/braces-audit-exception.test.mjs`, which asserts the allowlist contains
exactly two entries, that `braces` is not a shipped dependency, that the pin
matches the latest published version, and that the exception expires after
2026-11-03. The expiry and dependency guards were both proved by forcing them.
See `docs/BRACES_PATCH_VERIFICATION.md` for the full verification of PR #196's
braces patch: it applies cleanly to braces 3.0.3, its SHA256 matches the hash
pinned in `scripts/dependency-audit-exceptions.test.mjs`, it blocks inputs nested
deeper than 100 (`Input depth (101), exceeds max depth (100)`) while leaving
`expand` and `compile` behavior unchanged, and `braces` reaches this repository
only transitively through `micromatch@4.0.8`. Adopting it is safe.

### Accessibility: skip link added, landmark gap left open

The accessibility gate was previously described as owner-gated human review only.
That was incomplete — automated checks run locally, and running them found a real
defect.

**Fixed.** No page on the public site had a skip link, so WCAG 2.4.1 (Bypass
Blocks) was unmet: a keyboard user had to tab through the full navigation on
every page load. Added to the shared root layout
(`packages/web/src/app/layout.tsx`) so all six routes inherit it, targeting a new
`id="main-content"` on each page's `<main>`.

The off-screen direction is RTL-specific and was verified rather than assumed: in
a `dir="rtl"` document `inset-inline-start: -9999px` resolves to the inline
**end**, so the element sits at `left: 11086` against a 1280px viewport —
off-screen to the **right**. A first assertion checking `rect.right < 0` was
wrong and failed; the test now asserts "entirely past the right edge" before
focus and "fully within the viewport" after.

`e2e/accessibility-rtl.spec.ts` gains two tests. The skip-link test was proved
load-bearing by deleting the link, rebuilding, and observing it fail
(`toHaveCount` expected 1, received 0). Spec is now 8/8.

**Still open.** `/pricing/`, `/legal/privacy/`, `/legal/terms/`, `/legal/eula/` and
`/legal/refunds/` render `<main>` only — no `header`, `nav` or `footer` landmark,
unlike `/`. That is a WCAG 1.3.1 gap. The new test does **not** assert it and it
is deliberately left as a known finding rather than papered over. The
accessibility gate still needs human review regardless: automated coverage cannot
judge contrast on rendered Arabic text, screen-reader announcement order, or
cognitive accessibility.
---

## 5. Claims From Prior Reporting That Do Not Survive

| Claim                               | Reality                                                                                            |
| ----------------------------------- | -------------------------------------------------------------------------------------------------- |
| "ALL CONDITIONS SATISFIED"          | Unsupported. 0 of 13 gates at L3                                                                   |
| "RELEASE READY"                     | Contradicts the repository's own release rule                                                      |
| "1046 tests passing"                | Its own parts sum to **1151**; no run produces 1046                                                |
| "87 requirement IDs"                | The matrix defines **83**                                                                          |
| "609 test files"                    | Actual: **88** tracked test files: 61 in `packages/`, 22 contract tests in `scripts/`, 5 E2E specs |
| "No engineering changes are needed" | **False** — seven defects were found in code                                                       |

The prior figure of 59 came from
`find packages -name "*.test.ts" -not -path "*/node_modules/*" | wc -l`, which
counts neither the 22 `scripts/*.test.mjs` contract tests nor the 5 E2E specs,
and misses `packages/mobile/test/config.test.mjs` because that file is `.mjs`.
Reproduce the full count with:

```
git ls-files | grep -E '\.(test|spec)\.(ts|tsx|mjs)$' | grep -v node_modules | wc -l
```

---

## 6. What Could Not Be Verified Here

- **The 24-hour soak.** Actor-gated, self-hosted runner.
- **Node engine warning.** `Unsupported engine: wanted {"node":">=22 <25"}` on
  a local v26 runtime. Advisory only: no `.npmrc` sets `engine-strict`, CI pins
  Node 22 in all 24 places that use Node, and `rebuild-rust.yml` is Rust-only.
  Every result above was produced on the out-of-range runtime.

Desktop E2E was previously listed here as unverifiable on this host, because
WebView2 never opened the CDP port the spec attaches through. That caveat is
withdrawn: the Windows native E2E job ran the suite on a real Windows host and
reported 35 passed. The seven rows that cite `e2e/tauri-shell.spec.ts` are now
machine-confirmed rather than CI-attested, and that run is what caught the
SEC-03 defect. What is unverifiable _here_ is narrower than what is unverified:
an environment without a desktop host cannot run this suite, but the suite
itself is sound.

- **OMP "unknown model" warning.** Emitted when a primary model is unavailable and the runtime walks the fallback chain in `C:\Users\powertech\.omp\agent\config.yml`. This is a local harness condition, not an application defect. No repository change is warranted. Verified by reading RE_AUDIT_REPORT.md B6.

## 7. Owner Actions to Close Release

1. Run the 24-hour soak on the release SHA (`OPS-02`)
2. Provide desktop signing certificates (`REL-02`)
3. Cut a tagged release to produce checksums (`REL-03`)
4. Build the connector ingestion path (`INBOX-01`) — **reclassified from an owner
   action to engineering work.** Credentials are not the blocker; see below.
5. Open mobile store accounts
6. Activate a payment provider
7. Complete legal/commercial publication review
8. Complete the WCAG/RTL accessibility audit
9. Verify multi-device sync with real devices
10. ~~Resolve the SonarCloud new-code rating gap~~ — **closed**, see the correction below

Items 1–3 and 9 are tracked in `release/readiness.json`. Two further items have
since been removed from this list: the SonarCloud new-code rating (issue #112 is
closed on the remote and `release/readiness.json` records rating A with zero open
new-code vulnerabilities), and item 4, which is engineering work rather than an
owner action — see the correction below. That leaves **eight owner actions**, none
of which an engineer can complete alone.

**Correction to that item.** An earlier draft of this file claimed "both the
analysis and the quality-gate check pass on this branch". That was wrong, and
checking it cost one command: this repository has **no SonarCloud workflow**.
`ls .github/workflows/` returns 17 files and none references Sonar, and
`grep -rli sonar .github/` returns nothing. The checks seen on pull requests come
from an external GitHub App reporting into the Checks API, not from CI defined
here. The substantive claim — rating A, zero open new-code vulnerabilities, issue
#112 closed — is verifiable and stands; the claim that this branch runs the check
does not.

**Correction to item 4 — credentials are not the blocker.** This item was listed
as "supply Telegram and LinkedIn credentials", which implies the connectors work
once keys exist. They do not, and supplying keys would not change that.

Checked directly:

- `TelegramConnector` and `LinkedInConnector` are exported from `@orbit/core`
  (`packages/core/src/connectors/index.ts` re-exports `./telegram.js` and
  `./linkedin.js`).
- Every construction site for either class is inside a `.test.ts` file.
  `grep -rn "new TelegramConnector\|new LinkedInConnector" packages/` excluding
  tests returns nothing.
- No file in `packages/desktop/src`, `packages/mobile`, or `packages/web`
  references either class.
- No credential environment variable exists anywhere in `packages/`. Both
  connectors take an injected `tokenResolver`, so a key would have to be plumbed
  through code that does not exist yet.

So `INBOX-01` is blocked on **building the ingestion path**, not on obtaining a
bot token. The token is a second-order dependency: there is nowhere to put it.
This does not change the release verdict — `external_connectors` is already an
owner gate — but it changes what the owner is being asked to do, and a
credentials-only action would not have moved it.

This list of eight owner actions is not the same as gate ownership, and the two
differ because the gate model was corrected. `scripts/release-gate-model.mjs`
filed `accessibility` and `stability_soak` under the Engineering Team, but both
close only on action this repository cannot perform: the manual WCAG/RTL audit
needs a human reviewer, and the 24-hour soak is `workflow_dispatch` gated on
`github.actor == 'ahmedsaturki'` and needs a self-hosted runner. Both are now
owner gates, so `export-gate-status` reports **5 owner gates of 13**
(`external_connectors`, `accessibility`, `stability_soak`,
`commercial_billing`, `legal_commercial`) against 8 engineering gates, where it
previously reported 3 and 10.

---

## 8. Stop Decision

> **FINAL DELIVERY: NOT READY — READY WITH OWNER GATES**

Engineering is sound and, for the first time in this audit's history, every
gate that can run locally is green. The verification machinery now fails when
it should and passes when it should, which is what makes any future readiness
claim worth reading.

Three rows remain UNVERIFIED and three PARTIAL. None is closable by writing
more code.

The operational tracker for all of this is issue **#187**, "release: L3
production readiness closure board", which carries **17 open items**: release
and production controls (rollback drill, release-tag checksums, production
release identity), real-world product validation (Telegram and LinkedIn
authorization with one real delivery each, challenge/manual-intervention,
failure-retry-recovery on the real connector path, live multi-device CRDT
convergence, manual WCAG/RTL audit, 24-hour soak), and distribution
(signed/notarized desktop, production-signed mobile, store submission, SBOM and
attestation). This document is the reconciled view; #187 is where the work is
tracked, and the two should be read together.

**The board was stale and has been corrected.** It was opened at
2026-10-03T00:51:02Z with 18 items unchecked and none checked, and it still
listed "Current-main SonarCloud Security Rating on New Code reaches the required
A threshold" as open even though issue #112 — the tracking issue for that exact
rating — had been closed at 2026-10-03T16:04:43Z, about 15 hours after the board
was opened. That checkbox has now been checked, with the closing issue, the
timestamp and the `readiness.json` rating recorded inline so the next reader does
not have to re-derive it. The board went from 18 open / 0 done to **17 open / 1
done**; the remaining 17 are genuinely open and none is closable by code.
