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
| **Product**     | **PARTIAL**   | 78 of 83 requirements PASS. Three gaps are capability that was never built, not untested code                                                         |
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

### Windows native E2E: 37 passed, 0 failed

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
Windows native E2E  Run native and web E2E  37 passed (35.0s)
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

### The two remaining UNVERIFIED rows

`REL-03` was the third and is now **PASS**: run `37297712378` on tag `v1.0.5`
concluded `success` end to end and published the first GitHub Release in this
repository's history.

| ID       | What is missing             | Why it cannot be closed here                                          |
| -------- | --------------------------- | --------------------------------------------------------------------- |
| `OPS-02` | The 24-hour soak run        | `stability-soak.yml` is `workflow_dispatch` on a `self-hosted` runner |
| `REL-02` | Signed, notarized artifacts | Requires owner-controlled certificates                                |

**A completed 24-hour soak run exists, and it is not evidence.** Run `36260302282`
("ops: add one-shot push trigger for 24h main soak evidence") started
2026-09-26T17:48:00Z and its `soak` job ran until 2026-09-27T17:48:00Z — the
full 24 hours — before the run was cancelled. It is the only run of
`ORBIT Stability Soak` that has ever executed, and its duration is exactly what
`OPS-02` asks for, so it is easy to mistake for a closed item. It is not:

- it was triggered by a `push` to `ops/soak-trigger-20260926`, a branch that
  still exists on the remote and is not `main`;
- it predates `c3e4ac16` ("make 24h evidence fail-closed and durable", #105),
  which landed the next day and added the `test "${{ hours }}" = "24"`
  fail-closed assertion, the `github.actor == 'ahmedsaturki'` and `ref == 'main'`
  gates, and `pnpm test:soak:evidence`;
- it therefore carries none of the durability or exact-SHA binding those changes
  exist to enforce.

Until a dispatch run of the _current_ workflow completes on `main`, `OPS-02`
stays UNVERIFIED. A 24-hour wall-clock duration is not the requirement; durable,
fail-closed evidence bound to an exact SHA is.

### The three PARTIAL rows

| ID         | Evidence that exists                                   | What is still missing                                                 |
| ---------- | ------------------------------------------------------ | --------------------------------------------------------------------- |
| `INBOX-01` | Connector contracts, fixtures, challenge-stop behavior | No connector ingests conversations; `Connector.sync` is a placeholder |
| `DOC-01`   | Guide/env-var/loopback contract in CI                  | Prose and screenshots need human review                               |
| `DOC-02`   | Security exception register enforced by contract       | No executed human review of the threat model                          |

---

## 3. Defects Found and Fixed During This Audit

Each was proven load-bearing by reverting it and observing the failure.

| #   | Defect                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Class                                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1   | `soak.ts` recorded **requested** minutes as elapsed; a 1-minute run wrote `"minutes": 1440, "ok": true`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Verification asserting what it hadn't measured |
| 2   | Soak harness aborted at ~68 cycles on a claim-timestamp race                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Test-harness bug                               |
| 3   | `pnpm verify:workspace` failed repo-wide in **eleven** workflows since schema v17                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Gate red since 2026-10-04                      |
| 4   | Readiness evidence could cite files that no longer exist                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Unenforced truth claim                         |
| 5   | `pnpm audit` exited 1 in **five** workflows since 2026-09-25                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Security gate red                              |
| 6   | `conversation_upsert` audited under the global workspace, not its argument                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Cross-tenant audit write                       |
| 7   | Duplicate Rust test helpers (`upsert`, `grant`, `assert_unauthorized`) broke a name-uniqueness gate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Naming collision                               |
| 8   | Public web pages had no skip link (WCAG 2.4.1), so keyboard and screen-reader users had no bypass mechanism. **Fixed.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Accessibility                                  |
| 9   | Public web pages exposed no `banner`/`navigation`/`contentinfo` landmarks: every sub-page nested its `<header>` inside `<main>`, which does not map to a banner role (WCAG 1.3.1). **Fixed**                                                                                                                                                                                                                                                                                                                                                                                                                                            | Accessibility                                  |
| 10  | Release workflow ran `Browser E2E` (line 77) **before** `pnpm build` (line 80), but the suite serves `packages/web/out`; release run `37205123765` failed with `Timed out waiting 30000ms from config.webServer`, skipping the build and checksum steps and leaving `REL-03` without evidence. **Fixed**                                                                                                                                                                                                                                                                                                                                | Release pipeline never reaches publish         |
| 11  | `release-mobile.yml`, `self-hosted-verify.yml` and `web-release-selfhosted.yml` each carried a **doubled carriage return** on the same three-line "Governed audit exceptions" block, so the committed blob contained `\r\r\n` — not a valid YAML line terminator. GitHub rejected all three as "a workflow file issue" and none could execute. **Fixed**                                                                                                                                                                                                                                                                                | Three workflows unloadable                     |
| 12  | `release-mobile.yml` set `cancel-in-progress: true` — the only release workflow that would cancel a run mid-flight, discarding the artifact uploads the checksum step verifies. Its `concurrency:` block also sat before `on:`, and the group embedded the workflow's own filename. **Fixed**                                                                                                                                                                                                                                                                                                                                           | Mobile release discards its own evidence       |
| 13  | The `build` job of `release-desktop.yml` had no `playwright install` step, so `Generate app icons` and `Build desktop` both launched a headless Chromium (`scripts/build-icon.mjs`) against a browser that was never downloaded. The quality job installs browsers, but each job gets fresh runners with their own caches, so the install did not carry over. Release run `37283724466` on `v1.0.1` failed at `Build desktop` on **all four platforms** with `Executable doesn't exist at .../chrome-headless-shell`. **Fixed** by installing Chromium in the build job before icon generation.                                         | Release build produces no artifact             |
| 14  | The `publish` job of `release-desktop.yml` never ran `actions/checkout`, so `gh release create` failed with `failed to run git: fatal: not a git repository`. Run `37286268618` on `v1.0.2` built **all four** desktop artifacts and verified **314** checksums, then died on that one line — nothing was published. `gh` resolves the repository from git, and `--generate-notes` reads history. **Fixed** by checking out in the `publish` job.                                                                                                                                                                                       | Release produces no published artifact         |
| 15  | The `publish` step uploaded **every file** under `release-assets`, including the AppImage's entire `AppDir/` tree. 314 paths resolved to only **268 unique basenames** — 31 names collided (seven `orbit-marketing-os.png`, ten `copyright`). GitHub rejects duplicate asset names on a release, so run `37289634184` failed on the first upload with `HTTP 404` against a release id that never resolved. **Fixed** by selecting distributable bundles by extension (7 files, 7 unique basenames) and refusing to start an upload whose basenames are not unique.                                                                      | Release upload aborts on duplicate names       |
| 16  | The duplicate-basename guard added for defect 15 was itself wrong. It used `xargs -n1 basename` over newline-joined paths, and every bundle name contains spaces (`ORBIT Marketing OS_1.0.0_x64.dmg`), so `xargs` word-split each into three tokens: **7 real files reported 9 distinct names**. Run `37293663120` built all four artifacts, verified 314 checksums, and then aborted on `duplicate asset basenames would abort the upload` with no actual collision. **Fixed** with NUL-delimited `xargs -0`, verified against the real bundle names in both directions — 7 = 7 clean, and 3 files with 2 unique names still detected. | Guard aborts every release                     |

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

### Accessibility: skip link and landmarks both fixed

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

**Also fixed.** Every sub-page rendered `<main>` with its `<header>` nested
_inside_ it, so no page exposed `banner`, `navigation` or `contentinfo` landmarks
(WCAG 1.3.1) — and, per the ARIA mapping rules, a `<header>` inside `<main>` does
not become a banner at all. The first fix attempt placed the shared chrome inside
`<main>` and the landmark test correctly failed with `getByRole('banner')`
resolved to 0 elements. The header now sits outside `<main>` on all six routes.

Navigation and footer were extracted from the homepage into
`packages/web/src/components/site-chrome.tsx` and rendered by every page. Markup
and class names are unchanged, so this is a structure fix, not a restyle.

`e2e/accessibility-rtl.spec.ts` now covers all six routes for `main`, `banner`,
`navigation` and `contentinfo`, and both new tests were proved load-bearing by
removing the markup and observing them fail. Spec is 8/8; `public-web` and
`web-smoke` remain 15/15; web unit tests 5/5.

Confirmed independently in CI, not only locally: run `37234351368` on head
`a27c3789` reports `Accessibility and RTL audit — 8 passed (3.8s)` and
`Web E2E — 26 passed (8.2s)`, with the `ci` job concluding `success`.

**Still owner-gated.** The accessibility gate still needs human review: automated
coverage cannot judge contrast on rendered Arabic text, screen-reader announcement
order, or cognitive accessibility.
---

## 5. Claims From Prior Reporting That Do Not Survive

| Claim                               | Reality                                                                                            |
| ----------------------------------- | -------------------------------------------------------------------------------------------------- |
| "ALL CONDITIONS SATISFIED"          | Unsupported. 0 of 13 gates at L3                                                                   |
| "RELEASE READY"                     | Contradicts the repository's own release rule                                                      |
| "1046 tests passing"                | Its own parts sum to **1151**; no run produces 1046                                                |
| "87 requirement IDs"                | The matrix defines **83**                                                                          |
| "609 test files"                    | Actual: **89** tracked test files: 61 in `packages/`, 23 contract tests in `scripts/`, 5 E2E specs |
| "No engineering changes are needed" | **False** — sixteen defects were found in code                                                     |

The prior figure of 59 came from
`find packages -name "*.test.ts" -not -path "*/node_modules/*" | wc -l`, which
counts neither the 23 `scripts/*.test.mjs` contract tests nor the 5 E2E specs,
and misses `packages/mobile/test/config.test.mjs` because that file is `.mjs`.
Reproduce the full count with:

```
git ls-files | grep -E '\.(test|spec)\.(ts|tsx|mjs)$' | grep -v node_modules | wc -l
```

---

## 6. What Could Not Be Verified Here

- **The 24-hour soak.** Actor-gated, self-hosted runner. The path is verified
  ready, not merely untried: `scripts/soak.ts` accepts `--hours` and 24 resolves
  to 1440 minutes within safe-integer range; the JSONL log is one long-lived
  `createWriteStream` with `flags: "w"` closed once at the end, so ~25,700
  appends over a day do not leak descriptors; projected log size is ~3 MB from
  the 117 KB actually produced in 55 minutes; and `stability-soak.yml` sets
  `timeout-minutes: 1500`, leaving 60 minutes of headroom over the 1440-minute
  deadline for shutdown. The workflow also gates on `github.actor ==
'ahmedsaturki'` with `ref == 'main'` and hard-fails unless `hours` is exactly
  `24`, so a shorter run cannot be recorded as evidence. What is missing is a
  self-hosted x64 Linux runner and the run itself.
- **Node engine warning, and one script it actually breaks.**
  `Unsupported engine: wanted {"node":">=22 <25"}` on a local v26 runtime. No
  `.npmrc` sets `engine-strict`, CI pins Node 22 in all 24 places that use Node,
  and `rebuild-rust.yml` is Rust-only — so CI is unaffected.

  An earlier revision of this entry called the warning "advisory only". That was
  true of the pnpm warning and false of the runtime, and the distinction was
  never drawn. Checked this session by running all three smoke scripts on
  v26.7.0:

  | Script                    | On v26    |
  | ------------------------- | --------- |
  | `runtime-smoke.mjs`       | OK        |
  | `orbit-surface-smoke.mjs` | OK        |
  | `performance-smoke.mjs`   | **fails** |

  `performance-smoke.mjs` dies with
  `SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript parameter
property is not supported in strip-only mode` at
  `packages/core/src/queue/taskQueue.ts:36`. Node 22 strips TypeScript via
  `tsx`; Node 26 strips it natively and native stripping does not support
  parameter properties (`private readonly` in a constructor). The script is
  therefore **not runnable on Node >= 25**, which the package's own engine range
  already excludes.

  This is not a repository defect and needs no code change: `Performance smoke`
  is **success** on the latest `main` CI run `37307326606`, which uses Node 22,
  and the same step passes in all five workflows that run `test:performance`.
  It is recorded because anyone reproducing this audit's commands on Node 26 will
  hit a hard failure and reasonably assume something is broken.

Desktop E2E was previously listed here as unverifiable on this host, because
WebView2 never opened the CDP port the spec attaches through. That caveat is
withdrawn: the Windows native E2E job ran the suite on a real Windows host and
reported 37 passed. The seven rows that cite `e2e/tauri-shell.spec.ts` are now
machine-confirmed rather than CI-attested, and that run is what caught the
SEC-03 defect. What is unverifiable _here_ is narrower than what is unverified:
an environment without a desktop host cannot run this suite, but the suite
itself is sound.

- **OMP "unknown model" warning.** Emitted when a primary model is unavailable and the runtime walks the fallback chain in `C:\Users\powertech\.omp\agent\config.yml`. This is a local harness condition, not an application defect. No repository change is warranted. Verified by reading RE_AUDIT_REPORT.md B6.
- **Verifier test coverage, and a wrong claim corrected in place.** Nine
  verifier-style scripts are wired into `package.json`. Five have dedicated
  contract tests; four do not:

  | Script                                   | Runs in CI                                                        |
  | ---------------------------------------- | ----------------------------------------------------------------- |
  | `verify-live-production-observation.mjs` | `ci.yml` — covered by `production-observation-contract.test.mjs`  |
  | `verify-release-readiness.mjs`           | 4 workflows — covered by 2 test files                             |
  | `verify-workspace.mjs`                   | 11 workflows — covered                                            |
  | `check-release-gates.mjs`                | covered by `release-gate-tooling.test.mjs`                        |
  | `gate-dashboard.mjs`                     | covered by `gate-dashboard.test.mjs`                              |
  | `verify-e2e-parses.mjs`                  | `ci.yml` — now covered, and a defect fixed (see below)            |
  | `verify-ipc.mjs`                         | **5 workflows** — now covered by `verify-ipc-contract.test.mjs`   |
  | `verify-omp-contract.mjs`                | `ci.yml` — now covered by `verify-omp-contract.test.mjs`          |
  | `verify-release-docs.mjs`                | `ci.yml` — now covered by `verify-release-docs-contract.test.mjs` |

  An earlier revision of this entry listed all four uncovered scripts as
  reachable from **0 workflows**, on the reasoning that missing tests there
  were a maintenance risk rather than a release risk. That was wrong, and wrong
  in the reassuring direction. The survey grepped `.github/workflows/` for
  script filenames such as `verify-ipc.mjs`, but workflows invoke the npm
  aliases — `pnpm verify:ipc` — and never mention the file. Re-checked by
  alias:

  ```
  verify:e2e-parses    1 workflow  (ci.yml)
  verify:ipc           5 workflows (ci, release-desktop, release-evidence,
                                    release-mobile, self-hosted-verify)
  verify:omp           1 workflow  (ci.yml)
  verify:release-docs  1 workflow  (ci.yml)
  ```

  So all four gate CI, and `verify:ipc` gates five workflows. The real gap is
  worse than the retracted version claimed, not better: four untested verifiers
  sit in the merge path, one of them in every release workflow.

  `verify-e2e-parses.mjs` is the one to understand. It exists because
  `pnpm typecheck` runs `turbo run typecheck`, which only visits workspace
  packages — `e2e/` is not one, so nothing else would catch a syntax or binding
  error in a spec until the browser run. `verify:release-docs.mjs` was proved
  load-bearing this session by injecting all three forbidden claim shapes into
  `docs/DISTRIBUTION.md`: each was rejected with the file and line named, and
  the file restored byte-identical.

  `verify-ipc.mjs` was the highest-value gap and is now closed. It gates five
  workflows and enforces two security-relevant properties: that every command in
  `generate_handler!` carries `#[tauri::command]`, and that actor identity for
  `approval_request` / `approval_decide` is derived inside the runtime rather
  than asserted by the desktop UI. `verify-ipc-contract.test.mjs` drives the
  real script against fixture trees through a new `ORBIT_IPC_ROOT` override and
  covers all four guards, each proved to fail under mutation. Three of its own
  mistakes are worth recording, because all three produced a green-looking
  result for the wrong reason: a fixture missing the approval functions trips
  the mandatory check first; a fixture with no UI files leaves the `src`
  directory absent and the verifier dies with `ENOENT` rather than the rule
  under test; and a fixture leaving _two_ functions undecorated rejects on the
  first rather than the one under test. A rejection test that passes for the
  wrong reason is worse than no test, because it certifies nothing.

  `verify-omp-contract.mjs` is now covered too, by `verify-omp-contract.test.mjs`
  through an `ORBIT_OMP_ROOT` override: 15 cases covering the eleven required
  files, every mandatory marker, and the three frontmatter failure modes, each
  proved to fail under mutation of the required-file check, the marker check,
  the frontmatter check and the name-uniqueness check. One of its own lessons
  repeats the IPC one: deleting a required file surfaces as `ENOENT` from
  `access()` rather than as a curated message, so the assertion matches the
  error code and the path it names.

  `verify-release-docs.mjs` is now covered as well, by
  `verify-release-docs-contract.test.mjs` through an `ORBIT_DOCS_ROOT` override:
  12 cases covering all six forbidden claim shapes, the historical-evidence
  shapes that must stay allowed, the fact that a non-durable file is not
  scanned at all, and the scorecard cross-check against `readiness.json` in
  both directions. Three of its four mutations fail the suite — disabling the
  scan loop, removing the scorecard cross-check, and suppressing the failure
  report.

  **One mutation does not, and the gap is real.** Bypassing the script's own
  pattern self-test leaves this suite passing, because the fixtures hard-code
  the same claim shapes the patterns are built from: a broken pattern fails
  them identically. Covering it requires fixtures generated from the patterns
  themselves, which is circular — the test would assert the pattern against
  itself. The suite says so in a comment rather than implying full coverage.
  The self-test is real defence in the script itself; what is untested is the
  guarantee that it still fires.

  The last one, `verify-e2e-parses.mjs`, is now covered too — and writing the
  test found a real defect rather than confirming a working gate.

  The gate runs `tsc --noResolve` over the specs and reports only diagnostics
  that are not artifacts of unresolved imports. It already refused any exit
  status other than 0 or 2, on the reasoning that tsc exits 2 when it reports
  errors and 0 when clean, so any other status means it never started. That
  left one hole: **tsc exiting 2 with no output this gate could classify made it
  report `PASS`.** A gate that ran but could not read its own result was
  vouching for the specs. Reproduced with a stub compiler that exits 2 silently.

  The fix counts _any_ diagnostic line rather than only the real ones, because
  under `--noResolve` a spec full of unresolved imports legitimately exits 2
  with every diagnostic being filtered noise. My first attempt keyed the guard
  on `real.length` and broke the real `e2e/` run for exactly that reason — the
  repo's own specs failed until I counted filtered diagnostics too. That is the
  third time in this audit a correct-looking guard broke the passing case, and
  the reason every fix here is proven in both directions.

  `verify-e2e-parses-contract.test.mjs` drives the real script through an
  `ORBIT_E2E_SPEC_DIR` override plus an `ORBIT_TSC_BIN` stub, both inert when
  unset: 11 cases covering the duplicate-`const` binding error this gate was
  written for, a genuine type error, resolve noise _not_ being reported,
  recursive spec collection, an empty or missing directory, and three
  compiler-failure modes. All four guards proved to fail under mutation.

  All nine verifiers are now covered. Two claims of coverage are explicitly not
  made: the release-docs pattern self-test above, and nothing here standing in
  for a Playwright run — these suites prove the gates reject bad input, not that
  the browser tests pass.

- **Twenty-two unmerged pull requests carry work that is not on `main`.** 23 PRs
  are open, all predating this audit, the oldest from 2026-09-30. Every one is
  32–34 commits behind `main`, so none can merge cleanly without a rebase and
  re-verification. Comparing each PR head's blob against `main` for every file
  it touches:

  - **1 of 23 has landed** — #181 (`Content-Security-Policy`,
    `X-Frame-Options`, HSTS, `Permissions-Policy`) reached `main` by another
    route; `vercel.json` on `main` is byte-identical to that PR's version.
  - **22 still carry work absent from `main`**, including two security
    workflows: `dependency-review.yml` and `scorecard.yml`, proposed in #190 and
    #196 and present on neither.

  None of these can be merged as-is, and two are the reason:

  - `scorecard.yml` sets `publish_results: true`, which needs a
    `SCORECARD_TOKEN` secret. `gh secret list` returns nothing — the repository
    has **no secrets at all** — so that workflow would fail on every run until
    the token exists. That is an owner action, and it is a plausible reason it
    was never merged rather than an oversight.
  - #196 also edits `ci.yml` to replace
    `pnpm test:node-forge-audit-exception` with
    `pnpm test:dependency-audit-exceptions`. Neither that script nor
    `scripts/dependency-audit-exceptions.test.mjs` exists on `main`, so merging
    #196 as it stands would break `ci.yml` rather than improve it.

  `dependency-review.yml` alone is self-contained: it needs no secrets, runs on
  `pull_request` against `main`, and its action is pinned by digest. It is the
  one item here that could land without owner input or new code — but it is
  bundled in #196 with the Scorecard workflow and the CI rename, so it has to be
  separated first. Recorded rather than done, because unbundling someone else's
  stale PR is a judgement call the owner should make.

- **Two tracking issues carried a closed item as remaining work.** Issues #6 and
  #24 both list twelve remaining release-critical items, and both list
  "SonarCloud Security Rating A on New Code (latest observed remains B;
  required A)" as the first. That closed on 2026-10-03: issue #112 is closed,
  and `release/readiness.json` records `sonarNewSecurityRating: "A"`,
  `sonarOpenNewCodeVulnerabilities: 0` and `sonarQualityGate: "OK"`. Both
  bodies were edited on 2026-10-05 to strike the line and say what closed it,
  rather than leaving a completed item to read as outstanding.

  The other eleven items in both issues were re-checked against
  `release/readiness.json` and are all still open — none of their backing gates
  had moved. The correction was confined to the one stale line.

  The same drift existed in `docs/GATE_TRACKING.md`, corrected in
  `0d2f58db` (#233): that file had the stale blocker, `accessibility` and
  `stability_soak` mis-owned as Engineering when the exporter reports Owner
  Action, and a count line reading "10 engineering-owned, 3 commercial-owned"
  against an actual 8 / 3 / 2. All 13 rows were compared to
  `export-gate-status.mjs` and now agree on both level and owner. Issue #187 was
  checked and is already correct — its SonarCloud item is marked `[x]`.

- **A dated audit report keeps its findings; it gains a note.** A sweep of every
  Sonar rating claim in the repository found the same closed B rating stated a
  third time, in `docs/RE_AUDIT_REPORT.md` — headed `Date: 2026-10-04`, where B
  was the observed value. `3cdbd6b1` (#235) extends that file's existing
  `Superseded` banner to record the closure and name the real remaining blocker
  for `source_integrity`, an exact-SHA L3 evidence reference rather than the
  rating. The two B rows are deliberately unchanged: rewriting a point-in-time
  observation would falsify the record of what the audit found. The edit is a
  pure addition, confirmed by `git diff -w`.

  A document asserting the present is wrong and gets corrected. A document
  recording the past is accurate and gets marked. `docs/RELEASE_SCORECARD.md`
  also mentions the B and needed no change — it already reads "was `B` … the
  current state is A", so a sweep flagging it was a false positive to be
  checked, not acted on.

- **What an L3 evidence reference has to mean.** `scripts/verify-release-readiness.mjs`
  now refuses an L3 claim whose `verifiedAt` is older than 30 days or dated in
  the future, so the "exact verification timestamp" in `.omp/RULES.md:1` is
  enforced rather than merely formatted. Two properties remain unenforced, and
  both are deliberate stopping points rather than oversights:

  - **Substance.** Any non-empty string passes as an `evidenceRefs` entry. The
    verifier cannot know whether a reference supports the gate it is attached
    to without fetching and interpreting it, so a ref to an unrelated run
    satisfies the check. Enforcing relevance needs either per-gate ref schemas
    or an explicit maintainer assertion; a URL-pattern heuristic would give
    false assurance, which is worse than the honest gap.
  - **Currency is checked, relevance is not.** The 30-day window bounds how old
    evidence may be, not whether it is the right evidence. A claim can therefore
    cite fresh, well-formed, entirely irrelevant references.

  In practice the current gate set is unaffected: all 13 gates sit below L3, so
  no claim depends on this. It is recorded because the next person to promote a
  gate will meet a verifier that is stricter than it was and looser than
  `.omp/RULES.md` reads.

- **The 7-day production runtime error count.** `release/OBSERVED_PRODUCTION.json`
  records `runtimeErrors: {window: "7d", count: 0}`. No endpoint in this
  repository exposes error telemetry, so that figure is owner-attested from the
  Vercel dashboard and the live verifier checks its shape only — it reports
  `"runtimeErrorsMachineVerified": false` and now refuses any `verifiedBy` other
  than `owner`. The deployment itself is genuinely verified: `/`,
  `/api/health.json` and `/api/release.json` were re-requested and all return
  200 with `releaseSha` matching the recorded `9ba07318` and provenance
  `VERCEL_GIT_COMMIT_SHA`.

## 7. Owner Actions to Close Release

1. Run the 24-hour soak on the release SHA (`OPS-02`)
2. Provide desktop signing certificates (`REL-02`) — **confirmed blocked, not
   fixable by code.** Verified below.
3. ~~Cut a tagged release to produce checksums~~ — **closed.** Run
   `37297712378` on tag `v1.0.5` published the first GitHub Release in
   this repository's history: seven signed-format bundles plus
   `SHA256SUMS.txt`, with three assets re-verified by download against
   the published checksums. `REL-03` is **PASS**.
4. Build the connector ingestion path (`INBOX-01`) — **reclassified from an owner
   action to engineering work.** Credentials are not the blocker; see below.
5. Open mobile store accounts — **narrowed.** The app is already configured for
   both stores; only the accounts and signing credentials are missing. See below.
6. Activate a payment provider — **narrowed.** Checkout integration already exists
   and fails closed; only a provider account and three env vars are missing. See
   below.
7. Complete legal/commercial publication review — **confirmed owner-gated.** The
   pages themselves already state the requirement; see below.
8. Complete the WCAG/RTL accessibility audit — **automated portion done** (skip
   link and landmarks fixed, 8/8 with load-bearing proof). Human review of
   contrast and screen-reader behaviour remains. See below.
9. Verify multi-device sync with real devices — **narrowed.** The convergence and
   persistence logic is already covered by 16 executing tests over real loopback
   sockets; what remains is a physical-device check. See below.
10. ~~Resolve the SonarCloud new-code rating gap~~ — **closed**, see the correction below

Items 1–3 and 9 are tracked in `release/readiness.json`. Three further items
have since been removed from this list: the SonarCloud new-code rating (issue
#112 is closed on the remote and `release/readiness.json` records rating A with
zero open new-code vulnerabilities); item 4, which is engineering work rather
than an owner action; and item 3, which was owner-gated only while no tag
existed. That item is now closed outright: six tagged release runs have
executed and `v1.0.5` published the release. That leaves **six owner
actions**, none of which an engineer can complete alone.

**Correction to that item.** An earlier draft of this file claimed "both the
analysis and the quality-gate check pass on this branch". That was wrong, and
checking it cost one command: this repository has **no SonarCloud workflow**.
`ls .github/workflows/` returns 17 files and none references Sonar, and
`grep -rli sonar .github/` returns nothing. The checks seen on pull requests come
from an external GitHub App reporting into the Checks API, not from CI defined
here. The substantive claim — rating A, zero open new-code vulnerabilities, issue
#112 closed — is verifiable and stands; the claim that this branch runs the check
does not.

**Correction to item 9 — the sync logic is already verified; only hardware is
not.** This was filed as "verify multi-device sync with real devices", which
implies nothing about sync has been tested. It has.

`packages/core/test/sync.test.ts` and `packages/core/test/sync-network.test.ts`
contain **16 tests**, all passing (`vitest run` → 16 passed):

- bidirectional convergence across two independent documents over a **real
  `http.createServer` relay on `127.0.0.1`**, not a mocked transport — each side
  holds separate CRDT state and both end up identical
- three replicas converging to identical state
- convergence under reversed update-delivery order
- a delete racing a concurrent write
- idempotence when an update is redelivered
- replay with the wrong key and tampered ciphertext both refused before any state
  is applied
- offline edits after the last sync restored, not just synced ones
- an offline deletion surviving restart and not being resurrected by an older
  snapshot
- five restart cycles with neither loss nor drift

What that does **not** cover: real network conditions (packet loss, reordering
across a WAN, high latency), actual mobile backgrounding and process death,
key provisioning across physical devices, and clock skew. Those need hardware,
so the item stays — but it is now correctly scoped to a physical-device check
rather than an unverified subsystem.

**Correction to item 5 — the mobile app is already store-ready.** This was listed
as "open mobile store accounts", which implies packaging work remains. It does not.

- `packages/mobile/app.json` declares both identifiers — `android.package` and
  `ios.bundleIdentifier` are `com.orbitmarketing.os`, with `version 1.0.0`,
  `scheme: orbit`, and the `expo-router` and `expo-secure-store` plugins.
- `@orbit/mobile` typechecks clean and its 8 tests pass.
- `MOB-01` is PASS on the strength of run `37297712257`, which fired on tag
  `v1.0.5` alongside the desktop workflow and concluded `success`: quality gate
  11/11, then `Generate Android native project` and `Build debug APK`. The
  76 MB run artifact was downloaded and checked as a genuine APK — `PK` magic,
  `AndroidManifest.xml`, `classes.dex`, `resources.arsc`, both native ABIs.

What is missing is only the external half: the Apple Developer and Google Play
Console accounts, and the signing credentials that belong to them. There is no
`eas.json` and no EAS release configuration, so a store build has no configured
path yet — a small engineering step the owner can authorise, but it cannot be
done before the accounts exist. The item therefore stays, correctly scoped to
accounts plus a build pipeline rather than packaging.

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

**Correction to item 6 — checkout integration is already built and fails closed.**
This was listed as "activate a payment provider", implying the integration had to
be written. It exists and is deliberately provider-agnostic.

- `checkoutUrl(plan)` in `packages/web/src/app/pricing/page.tsx` resolves
  `NEXT_PUBLIC_CHECKOUT_<PLAN>` from the environment and returns `"#"` when unset.
- Each plan renders a real purchase anchor only when a URL is configured;
  otherwise it renders a non-interactive element. There is no dead "buy" button
  and no fake link.
- `e2e/web-smoke.spec.ts` asserts this directly — "pricing page renders all
  license plans without fake checkout links" — and passes.
- No payment SDK (Stripe, PayPal, Paddle, Lemon Squeezy) is vendored, and no
  payment secret exists in the repository.

So choosing a provider is genuinely an owner decision, but a configuration one,
not an integration one: set the three environment variables and checkout goes
live. What cannot be short-circuited is that a provider requires a commercial
account, and selling at all requires the legal review in item 7.

This list of six owner actions is not the same as gate ownership, and the two
differ because the gate model was corrected. `scripts/release-gate-model.mjs`
filed `accessibility` and `stability_soak` under the Engineering Team, but both
close only on action this repository cannot perform: the manual WCAG/RTL audit
needs a human reviewer, and the 24-hour soak is `workflow_dispatch` gated on
`github.actor == 'ahmedsaturki'` and needs a self-hosted runner. Both are now
owner gates, so `export-gate-status` reports **5 owner gates of 13**
(`external_connectors`, `accessibility`, `stability_soak`,
`commercial_billing`, `legal_commercial`) against 8 engineering gates, where it
previously reported 3 and 10.

**Item 2 (signing certificates) — verified as genuinely blocked.** Checked rather
than assumed:

- `git ls-files` returns **no** `.p12`, `.pfx`, `.pem`, `.key`, `.cer`, `.der`,
  `.jks`, `.keystore`, `id_rsa` or `.env` file. No key material is tracked, which
  is the correct state.
- `.github/workflows/release-desktop.yml` contains exactly one signing reference:
  the provenance line `signing=unsigned`. No certificate, keystore, Apple ID or
  ASC-key secret is referenced, because the pipeline is unsigned by design.
- `docs/DISTRIBUTION.md` states the policy explicitly: signing is a separate
  release gate that **must never use private signing keys committed to the
  repository**.

There is no code change that could close this. Generating or storing a signing
certificate inside this repository would violate the stated policy, so the item
is correctly owner-gated and stays UNVERIFIED in the matrix.

**Item 7 (legal/commercial review) — verified as genuinely owner-gated.** The
published pages do not pretend to be finished legal text; they say so on their
face, in the customer-facing copy:

- refunds and EULA: the text requires legal review before commercial sale or
  commercial launch
- refunds: policy must be published clearly before payment is collected
- refunds: a commercial support channel and official contact address are
  required before paid launch

That is the correct engineering posture: the surfaces exist and are reachable,
and they are explicitly not represented as legally approved. Only a qualified
reviewer can close this, so it stays owner-gated.

---

## 8. Stop Decision

> **FINAL DELIVERY: NOT READY — READY WITH OWNER GATES**

Engineering is sound and, for the first time in this audit's history, every
gate that can run locally is green. The verification machinery now fails when
it should and passes when it should, which is what makes any future readiness
claim worth reading.

Two rows remain UNVERIFIED and three PARTIAL. None is closable by writing more
code. `REL-03` left the UNVERIFIED set when run `37297712378` published the
first GitHub Release in this repository's history on tag `v1.0.5`.

The operational tracker for all of this is issue **#187**, "release: L3
production readiness closure board", which carries **16 open items**: release
and production controls (rollback drill, production release identity),
real-world product validation (Telegram and LinkedIn authorization with one
real delivery each, challenge/manual-intervention, failure-retry-recovery on
the real connector path, live multi-device CRDT convergence, manual WCAG/RTL
audit, 24-hour soak), and distribution (signed/notarized desktop,
production-signed mobile, store submission, SBOM and attestation). This
document is the reconciled view; #187 is where the work is tracked, and the two
should be read together.

**The board was stale and has been corrected, twice.** It was opened at
2026-10-03T00:51:02Z with 18 items unchecked and none checked, and it still
listed "Current-main SonarCloud Security Rating on New Code reaches the required
A threshold" as open even though issue #112 — the tracking issue for that exact
rating — had been closed at 2026-10-03T16:04:43Z, about 15 hours after the board
was opened. That checkbox has now been checked, with the closing issue, the
timestamp and the `readiness.json` rating recorded inline so the next reader does
not have to re-derive it.

The second item closed on the same evidence that closed `REL-03`: "Final
release-tag checksum/provenance drill completed", now checked with the
`v1.0.5` run evidence inline. The board went from 18 open / 0 done to **16 open /
2 done**; the remaining 16 are genuinely open and none is closable by code.
