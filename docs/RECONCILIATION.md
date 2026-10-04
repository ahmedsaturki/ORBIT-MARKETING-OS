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

| Check                                                                                                       | Result                     |
| ----------------------------------------------------------------------------------------------------------- | -------------------------- |
| `verify:workspace`, `verify:readiness`, `verify:release-docs`, `verify:release`, `verify:ipc`, `verify:omp` | 6/6 PASS                   |
| `pnpm test`                                                                                                 | 524 tests, 4/4 tasks PASS  |
| `pnpm typecheck`                                                                                            | 5/5 PASS                   |
| `scripts/health-model-availability.test.mjs`                                                                | PASS                       |
| `scripts/soak-failure-evidence.test.mjs`                                                                    | PASS                       |
| `scripts/braces-audit-exception.test.mjs`                                                                   | PASS                       |
| `scripts/node-forge-audit-exception.test.mjs`                                                               | PASS (after the fix above) |
| `scripts/release-gate-model.test.mjs`                                                                       | PASS                       |
| `scripts/user-guide-contract.test.mjs`                                                                      | PASS                       |
| `cargo test`                                                                                                | **182 passed, 0 failed**   |
| `cargo clippy --all-targets -- -D warnings`                                                                 | clean                      |
| `cargo fmt --check`                                                                                         | clean                      |

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
current `lib.rs` carries 170 `#[test]` / `#[tokio::test]` attributes plus the
integration suites. See the test evidence report for the full breakdown.

## Still open, and genuinely so

These are owner-gated and no code closes them: release signing credentials,
Apple/Google store accounts, TLS certificates for the production host, a
24-hour soak on the exact release SHA (the workflow is actor-gated and needs a
self-hosted runner), and the manual WCAG/RTL audit.

## Open PRs that overlap this branch

Published as PR #213. Five PRs were already open against `main`; this branch
shares 8 files with two of them.

| File | PR #195 | PR #196 |
|---|---|---|
| `scripts/soak-failure-evidence.test.mjs` | yes | — |
| `scripts/orbit-surface-smoke.mjs` | yes | — |
| `scripts/commercial-connector-proof.safe.test.mjs` | yes | — |
| `docs/SECURITY_EXCEPTIONS.md` | — | yes |
| `pnpm-workspace.yaml` | — | yes |
| `package.json`, `.github/workflows/ci.yml` | yes | yes |

### The `braces` exception needs a single owner

Two PRs now write the same lines in `pnpm-workspace.yaml`, so only one can land.

- This branch suppresses the advisory with an `ignoreGhsas` entry plus a
  rationale comment and a time-boxed contract test.
- PR #196 fixes the underlying code with a 190-line patch derived from upstream
  (`patches/braces@3.0.3.patch`) **and** keeps the ignore.

Both are defensible on the facts: `braces@3.0.3` genuinely is still the latest
published version, so there is no upgrade to take and the advisory's "no patched
version" claim is accurate rather than assumed.

**Recommendation: keep #196's patch and drop this branch's rationale comment at
merge time.** A patch remediates the defect; an ignore documents that we chose
not to. The ignore earns its place only while the patch is absent.

`node-forge@1.4.0.patch` is unaffected — this branch owns that one, and it
resolves `GHSA-86w9-cpqp-85rv` rather than suppressing it.
