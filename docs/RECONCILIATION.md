# Branch Reconciliation Against `origin/main`

The audit ran against a local `main` that had drifted from the remote: 40
commits ahead, **13 behind**. This records how that drift was resolved, so the
next person does not have to re-derive it or trust a stale clone.

Resolution commit: `698ea43f` (merge, not rebase — a merge keeps the audit
history legible and leaves the upstream commits addressable).

## What the 13 upstream commits were

| Commit     | Subject                                                                    |
| ---------- | -------------------------------------------------------------------------- |
| `3978c0fc` | Close SonarCloud S5145 + 9x S4036 findings (#200)                          |
| `daff2746` | Acceptance matrix restructure with enforced Status column (#205)           |
| `77517a48` | Action-pinning gate for all 17 workflows + audit-exception ordering (#202) |
| `4a07914e` | Windows pnpm spawn repair; correct four inflated matrix statuses (#207)    |
| `ddf73d99` | Record SonarCloud new-code security rating A (#212)                        |
| others     | Provenance verifier, performance budgets, CI triage partitioning           |

## Three findings retracted

Comparing the branch against `origin/main` falsified claims made earlier:

- **`pnpm audit` red in five workflows** — false. `3978c0fc` already added the
  `GHSA-vfj7-8cjw-p6xm` ignore upstream. The governed exception added here was a
  duplicate of existing work.
- **`verify:workspace` red in eleven workflows** — false as stated. `origin/main`
  is at schema **16** and correctly pins 16. Schema v17 exists only here.
- **Duplicate Rust test helpers broke the gate** — not applicable upstream;
  `origin/main` has none of them.

One finding was narrowed: the conversation audit-workspace defect exists only
in this branch's refactor, because upstream never extracted a
`conversation_upsert_record` helper for the mismatch to arise in.

## The eight conflicts

Resolved by checking which side was factually right, not by preferring a side.

| File                                               | Resolution          | Basis                                                                                      |
| -------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------ |
| `scripts/soak.ts`                                  | **Both**            | Upstream's RSS budget comment and this branch's `--max-cycles` are unrelated additions     |
| `pnpm-workspace.yaml`                              | **Both**            | Upstream carries the advisory ids; this branch adds the rationale                          |
| `release/readiness.json`                           | **Both, corrected** | See below                                                                                  |
| `scripts/soak-failure-evidence.test.mjs`           | **Upstream**        | Strict superset: keeps the SHA-mismatch assertions, adds the short-run case, uses `runTsx` |
| `scripts/orbit-surface-smoke.mjs`                  | **Upstream**        | Follows upstream's `spawnPnpm` → `runTsx` refactor                                         |
| `scripts/commercial-connector-proof.safe.test.mjs` | **Upstream**        | Same refactor                                                                              |
| `docs/SECURITY_EXCEPTIONS.md`                      | **Upstream**        | Identical node-forge section, fuller braces entry with machine-checked mitigations         |
| `docs/ACCEPTANCE_MATRIX_V2.md`                     | **This branch**     | All four disagreeing statuses checked individually                                         |

### The readiness correction

Upstream's text claimed `logs/soak-summary.json` records `startedAt` and that
its timestamps "bracket a genuine 10-minute span". The artifact's keys are
`runId, minutes, cycles, healthOk, healthFails, staticFails, chatResponses,
chatErrors, rssMinMb, rssMaxMb, rssFirstMb, rssLastMb, rssBudgetMb, failures, ok,
finishedAt` — there is **no `startedAt`, no `elapsedMinutes`, and no `gitSha`**.

The merged note therefore states what the artifact actually contains and keeps
`OPS-02` **UNVERIFIED**. A run that cannot be independently time-bracketed and
is not bound to a commit should not be read as proving a 24-hour soak.

### The four matrix statuses

| ID         | Upstream | Here           | Why                                                                                                                                                                                           |
| ---------- | -------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AI-01`    | PARTIAL  | **PASS**       | `scripts/health-model-availability.test.mjs` asserts `/api/health` only reports ok when the configured Ollama models are installed. It runs green. Upstream cited only a client contract test |
| `INBOX-01` | PASS     | **PARTIAL**    | `TelegramConnector.sync` returns `this.connect(context)`; `connect` only validates credentials. Nothing ingests into the unified conversation model                                           |
| `UI-01`    | PARTIAL  | **PASS**       | Mission Control tests pass with no server-side secrets                                                                                                                                        |
| `REL-02`   | PARTIAL  | **UNVERIFIED** | No code defect: the pipeline deliberately builds unsigned. Release signing is owner-controlled policy, not a defect to fix                                                                    |

## Defect the merge introduced

`scripts/node-forge-audit-exception.test.mjs` auto-merged with `BRACES_GHSA`
declared twice — a `SyntaxError`, so the file would not load at all. Both sides
had added the constant. Removing this branch's redundant copy fixed it. This is
the one defect the reconciliation itself created, and it is the reason the
contract scripts were each run individually rather than trusting the suite.

## Verification on the merged tree

| Check                                                                                                       | Result                                                                        |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `verify:workspace`, `verify:readiness`, `verify:release-docs`, `verify:release`, `verify:ipc`, `verify:omp` | 6/6 PASS                                                                      |
| `pnpm test`                                                                                                 | 379 tests (core 357, desktop 9, mobile 8, web 5), 4/4 tasks PASS, matching CI |
| `pnpm typecheck`                                                                                            | 5/5 PASS                                                                      |
| `scripts/health-model-availability.test.mjs`                                                                | PASS                                                                          |
| `scripts/soak-failure-evidence.test.mjs`                                                                    | PASS                                                                          |
| `scripts/braces-audit-exception.test.mjs`                                                                   | PASS                                                                          |
| `scripts/node-forge-audit-exception.test.mjs`                                                               | PASS (after the fix above)                                                    |
| `scripts/release-gate-model.test.mjs`                                                                       | PASS                                                                          |
| `scripts/user-guide-contract.test.mjs`                                                                      | PASS                                                                          |
| `cargo test`                                                                                                | **182 passed, 0 failed**                                                      |
| `cargo clippy --all-targets -- -D warnings`                                                                 | clean                                                                         |
| `cargo fmt --check`                                                                                         | clean                                                                         |

### The Rust suite took a second attempt

The first `cargo test` could not run at all. It failed with
`LNK1108: cannot write file at 0x0` and `There is not enough space on the disk
(os error 112)` — the `C:` volume was at 100%, with roughly 800 MB free of
390 GB. `cargo clean` released 879 MiB, which was not enough, and the space is
consumed from outside this repository.

The fix was not to free the repository but to move the build. `D:` had free
space, so the suite ran with `CARGO_TARGET_DIR=D:/orbit-cargo-target`:

```bash
$ CARGO_TARGET_DIR=D:/orbit-cargo-target cargo test
running 182 tests
test result: ok. 182 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

So the desktop native side **is** verified against the merged file, including
the schema v17 migration. The earlier "unverified" caveat is retired rather than
left in place — it was true when written and is no longer.

Note that 182 is well above the 105 in the older completion report, and the
source confirms it independently: `src/` and `tests/` carry exactly 182
`#[test]` attributes, which is the number quoted above. **CI does not execute
that same 182.** The `Rust quality` job in run 37134186892 reports `105 passed`
plus `1 passed` with `104 filtered out` — a filtered subset, not the full suite.
The full `--all-targets` count is a local measurement; CI's green `Rust tests`
step proves the subset passes, not that 182 tests were executed. Both statements
are true and the difference is the filter, not a disagreement. See the test
evidence report for the full breakdown.

## What CI found that local runs could not

Publishing as PR #213 surfaced three failures that a single Windows machine
could never show. All three are now fixed.

### 1. The build failed on all four platforms

`@orbit/desktop`'s build runs `scripts/build-icon.mjs`, which rasterizes the app
icon through headless Chromium. No workflow had Chromium installed at that
point:

```
browserType.launch: Executable doesn't exist at .../chrome-headless-shell
```

In `ci.yml` the Build step ran at line 152 and `playwright install` at line 155,
so the build was guaranteed to fail. Three more workflows had the same latent
bug: `release-desktop.yml` built with no install before it, `desktop-native-validation.yml`
reached it through `tauri build`'s `beforeBuildCommand`, and `stability-soak.yml`
had no install anywhere in the job. All four install Chromium first now.

### 2. SonarCloud failed the quality gate on this branch's own code

`javascript:S4036` at `scripts/build-tauri.mjs:83` — the new frontend prebuild
called `spawnSync` with `shell: true`, which Sonar flags as a PATH injection
vector because the child runs through a shell. Replaced with the repository's
existing `spawnPnpm` helper, which handles the Windows `.cmd` requirement
centrally and documents why shell execution is safe there: every argument is a
literal from the call site. SonarCloud now reports **0 security issues** on the
pull request.

The `S2187` findings on the node-run contract scripts are not defects. Those
files hold 9 to 28 assertions each and execute under plain `node` via
`package.json` scripts; Sonar expects a test framework inside the file.

### 3. Format check failed

Most of what it reported is this machine's `core.autocrlf=true` rewriting files
to CRLF on checkout — 106 files flagged locally against **107 on a clean
`origin/main`**. With CRLF disabled the real number was 26, of which 25 were
files this branch touched. Those are formatted; the branch now introduces zero
format violations relative to upstream's own baseline.

## Still open, and genuinely so

These are owner-gated and no code closes them: release signing credentials,
Apple/Google store accounts, TLS certificates for the production host, a
24-hour soak on the exact release SHA (the workflow is actor-gated and needs a
self-hosted runner), and the manual WCAG/RTL audit.

## Open PRs that overlap this branch

Published as PR #213. Five PRs were already open against `main`, and three of
them share files with this branch: **9 distinct paths across 15 file-instances**.

This section previously reported 7 files against two PRs. That was wrong in both
directions: PR #198 was never checked, and the count of 7 double-counted
`ci.yml` and `package.json` because two PRs each touch them. Recomputed against
the current heads rather than carried forward.

| File                                               | #195 | #196 | #198 |
| -------------------------------------------------- | ---- | ---- | ---- |
| `.github/workflows/ci.yml`                         | yes  | yes  | yes  |
| `package.json`                                     | yes  | yes  | yes  |
| `docs/SECURITY_EXCEPTIONS.md`                      | —    | yes  | yes  |
| `pnpm-workspace.yaml`                              | —    | yes  | yes  |
| `scripts/soak-failure-evidence.test.mjs`           | yes  | —    | —    |
| `scripts/orbit-surface-smoke.mjs`                  | yes  | —    | —    |
| `scripts/commercial-connector-proof.safe.test.mjs` | yes  | —    | —    |
| `.github/workflows/release-desktop.yml`            | —    | —    | yes  |
| `packages/desktop/src-tauri/Cargo.toml`            | —    | —    | yes  |

### These three are not independent, and merge order matters more than it looks

All three branch from the same base, `01cd0622`. None of them contains
`origin/main` (`ddf73d99`), which arrived later:

| PR   | Commits ahead of `origin/main` | Commits behind |
| ---- | ------------------------------ | -------------- |
| #195 | 13                             | 7              |
| #196 | 13                             | 19             |
| #198 | 13                             | 27             |

The apparent conflicts are not three independent sets of edits. Diffing #198's
`package.json` against this branch's shows the difference is **entirely
additive on this side**: #198 lacks `build:icons`, `test:exec-trusted`,
`test:script-contracts`, `verify:e2e-parses` and every gate-model script added
after it was opened. Those are the same lines #198 would contribute, at an
earlier state of the same effort.

So #198 is best read as a **superseded snapshot plus a distinct security
track**, not a competing change. Merging it wholesale would revert work, not
reconcile with it.

### What only #198 has, and it is not nothing

Correcting the framing above: #198 also contributes 13 files this branch does
not have, and they are supply-chain security controls, not cosmetics. "Superseded
snapshot" is true of the overlap, not of the PR.

| File                                                              | What it adds                                                |
| ----------------------------------------------------------------- | ----------------------------------------------------------- |
| `deny.toml`                                                       | cargo-deny policy: advisory and license allowlists, sources |
| `.github/workflows/cargo-quality.yml`                             | Runs cargo-deny against that policy                         |
| `.github/workflows/codeql.yml`                                    | CodeQL, weekly                                              |
| `.github/workflows/dependency-review.yml`                         | PR dependency review                                        |
| `.github/workflows/scorecard.yml`                                 | OpenSSF Scorecard, weekly                                   |
| `.github/workflows/actions-quality.yml`                           | zizmor workflow-security scan                               |
| `.zizmor.yml`                                                     | zizmor config, exempting `ci.yml` as a dangerous trigger    |
| `.github/workflows/links.yml`                                     | lychee documentation link check                             |
| `.github/workflows/lighthouse.yml`                                | Lighthouse web quality gate                                 |
| `.lighthouserc.json`, `.lycheeignore`                             | Configuration for the two above                             |
| `docs/QUALITY_AND_RELEASE_ACTIONS.md`, `docs/SECURITY_ACTIONS.md` | Documentation for the above                                 |
| `scripts/audit-exceptions-contract.test.mjs`                      | Predecessor of this branch's exception contracts            |

Two of these interact with work on this branch rather than sitting beside it.

- **zizmor** analyses the workflow-security posture of `.github/workflows`, and
  this branch edits five workflows, including a SonarCloud `spawnSync` fix.
  `.zizmor.yml` exempts `ci.yml` from `dangerous-triggers`; that exemption is
  worth reviewing on its merits rather than inherited blind.
- **cargo-deny** asserts a license allowlist over the Rust dependency graph.
  The 505-crate `Cargo.lock` records no license fields, so this cannot be
  checked from the lockfile; it needs cargo-deny to fetch crate metadata from
  the registry. **Run against this tree, and it does not pass as written.**

  ```
  error[unlicensed]: orbit-marketing-os = 1.0.0 is unlicensed
  advisories ok, bans ok, licenses FAILED, sources ok
  ```

  One cause, and it is this project rather than any dependency: every one of the
  504 third-party crates satisfies the allowlist, but
  `packages/desktop/src-tauri/Cargo.toml` declares no `license` field, so the
  workspace's own crate is unlicensed. There is no copyleft or unknown-license
  problem in the graph.

  Adopting the policy therefore needs a decision this repository has not made:
  what licence `orbit-marketing-os` is under. Declaring one is a legal call, not
  a mechanical one, which is why it is recorded here rather than fixed. The
  `webpki-roots` exception and the `CDLA-Permissive-2.0` entry are also reported
  as `license-not-encountered`, so the allowlist carries entries this tree does
  not currently exercise.

The owner decision is therefore narrower than "merge or close #198": it is which
of these controls to adopt, plus the licence question above, which has to be
answered before the cargo-deny gate could pass on this tree.

### The `braces` exception needs a single owner

Three PRs now write the same lines in `pnpm-workspace.yaml`, so only one can land.

- This branch suppresses the advisory with an `ignoreGhsas` entry plus a
  rationale comment and a time-boxed contract test.
- PR #196 fixes the underlying code with a 190-line patch derived from upstream
  (`patches/braces@3.0.3.patch`) **and** keeps the ignore.

Both are defensible on the facts: `braces@3.0.3` genuinely is still the latest
published version, so there is no upgrade to take and the advisory's "no patched
version" claim is accurate rather than assumed. That is no longer taken on
trust: `scripts/braces-audit-exception.test.mjs` now queries the npm registry and
fails if the pin stops being the latest published version.

**Recommendation: keep #196's patch and drop this branch's rationale comment at
merge time.** A patch remediates the defect; an ignore documents that we chose
not to. The ignore earns its place only while the patch is absent.

The two are not in conflict on the test file itself. #196 adds
`patches/braces@3.0.3.patch` and touches neither
`scripts/braces-audit-exception.test.mjs` nor `docs/SECURITY_EXCEPTIONS.md`, so
the contract can land either side of that decision. An earlier note in this
document treated the two as competing edits to the contract; they are not.

`node-forge@1.4.0.patch` is unaffected — this branch owns that one, and it
resolves `GHSA-86w9-cpqp-85rv` rather than suppressing it.
