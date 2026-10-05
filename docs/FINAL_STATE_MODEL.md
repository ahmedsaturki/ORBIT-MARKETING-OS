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

| #   | Defect                                                                                                                                                                                                                                                                                                                                                   | Class                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1   | `soak.ts` recorded **requested** minutes as elapsed; a 1-minute run wrote `"minutes": 1440, "ok": true`                                                                                                                                                                                                                                                  | Verification asserting what it hadn't measured |
| 2   | Soak harness aborted at ~68 cycles on a claim-timestamp race                                                                                                                                                                                                                                                                                             | Test-harness bug                               |
| 3   | `pnpm verify:workspace` failed repo-wide in **eleven** workflows since schema v17                                                                                                                                                                                                                                                                        | Gate red since 2026-10-04                      |
| 4   | Readiness evidence could cite files that no longer exist                                                                                                                                                                                                                                                                                                 | Unenforced truth claim                         |
| 5   | `pnpm audit` exited 1 in **five** workflows since 2026-09-25                                                                                                                                                                                                                                                                                             | Security gate red                              |
| 6   | `conversation_upsert` audited under the global workspace, not its argument                                                                                                                                                                                                                                                                               | Cross-tenant audit write                       |
| 7   | Duplicate Rust test helpers (`upsert`, `grant`, `assert_unauthorized`) broke a name-uniqueness gate                                                                                                                                                                                                                                                      | Naming collision                               |
| 8   | Public web pages had no skip link (WCAG 2.4.1), so keyboard and screen-reader users had no bypass mechanism. **Fixed.**                                                                                                                                                                                                                                  | Accessibility                                  |
| 9   | Public web pages exposed no `banner`/`navigation`/`contentinfo` landmarks: every sub-page nested its `<header>` inside `<main>`, which does not map to a banner role (WCAG 1.3.1). **Fixed**                                                                                                                                                             | Accessibility                                  |
| 10  | Release workflow ran `Browser E2E` (line 77) **before** `pnpm build` (line 80), but the suite serves `packages/web/out`; release run `37205123765` failed with `Timed out waiting 30000ms from config.webServer`, skipping the build and checksum steps and leaving `REL-03` without evidence. **Fixed**                                                 | Release pipeline never reaches publish         |
| 11  | `release-mobile.yml`, `self-hosted-verify.yml` and `web-release-selfhosted.yml` each carried a **doubled carriage return** on the same three-line "Governed audit exceptions" block, so the committed blob contained `\r\r\n` — not a valid YAML line terminator. GitHub rejected all three as "a workflow file issue" and none could execute. **Fixed** | Three workflows unloadable                     |
| 12  | `release-mobile.yml` set `cancel-in-progress: true` — the only release workflow that would cancel a run mid-flight, discarding the artifact uploads the checksum step verifies. Its `concurrency:` block also sat before `on:`, and the group embedded the workflow's own filename. **Fixed**                                                            | Mobile release discards its own evidence       |

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
| "No engineering changes are needed" | **False** — twelve defects were found in code                                                      |

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
- **Node engine warning.** `Unsupported engine: wanted {"node":">=22 <25"}` on
  a local v26 runtime. Advisory only: no `.npmrc` sets `engine-strict`, CI pins
  Node 22 in all 24 places that use Node, and `rebuild-rust.yml` is Rust-only.
  Every result above was produced on the out-of-range runtime.

Desktop E2E was previously listed here as unverifiable on this host, because
WebView2 never opened the CDP port the spec attaches through. That caveat is
withdrawn: the Windows native E2E job ran the suite on a real Windows host and
reported 37 passed. The seven rows that cite `e2e/tauri-shell.spec.ts` are now
machine-confirmed rather than CI-attested, and that run is what caught the
SEC-03 defect. What is unverifiable _here_ is narrower than what is unverified:
an environment without a desktop host cannot run this suite, but the suite
itself is sound.

- **OMP "unknown model" warning.** Emitted when a primary model is unavailable and the runtime walks the fallback chain in `C:\Users\powertech\.omp\agent\config.yml`. This is a local harness condition, not an application defect. No repository change is warranted. Verified by reading RE_AUDIT_REPORT.md B6.

## 7. Owner Actions to Close Release

1. Run the 24-hour soak on the release SHA (`OPS-02`)
2. Provide desktop signing certificates (`REL-02`) — **confirmed blocked, not
   fixable by code.** Verified below.
3. Cut a tagged release to produce checksums (`REL-03`)
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
- `MOB-01` is PASS on the strength of the `mobile-validation` workflow
  (typecheck + `expo prebuild` + `gradle assembleDebug`).

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
