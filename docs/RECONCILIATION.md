# Branch Reconciliation Against `origin/main`

The audit ran against a local `main` that had drifted from the remote: 40
commits ahead, **13 behind**. This records how that drift was resolved, so the
next person does not have to re-derive it or trust a stale clone.

Resolution commit: `698ea43f` (merge, not rebase — a merge keeps the audit
history legible and leaves the upstream commits addressable).

## What the 13 upstream commits were

| Commit | Subject |
|---|---|
| `3978c0fc` | Close SonarCloud S5145 + 9x S4036 findings (#200) |
| `daff2746` | Acceptance matrix restructure with enforced Status column (#205) |
| `77517a48` | Action-pinning gate for all 17 workflows + audit-exception ordering (#202) |
| `4a07914e` | Windows pnpm spawn repair; correct four inflated matrix statuses (#207) |
| `ddf73d99` | Record SonarCloud new-code security rating A (#212) |
| others | Provenance verifier, performance budgets, CI triage partitioning |

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

| File | Resolution | Basis |
|---|---|---|
| `scripts/soak.ts` | **Both** | Upstream's RSS budget comment and this branch's `--max-cycles` are unrelated additions |
| `pnpm-workspace.yaml` | **Both** | Upstream carries the advisory ids; this branch adds the rationale |
| `release/readiness.json` | **Both, corrected** | See below |
| `scripts/soak-failure-evidence.test.mjs` | **Upstream** | Strict superset: keeps the SHA-mismatch assertions, adds the short-run case, uses `runTsx` |
| `scripts/orbit-surface-smoke.mjs` | **Upstream** | Follows upstream's `spawnPnpm` → `runTsx` refactor |
| `scripts/commercial-connector-proof.safe.test.mjs` | **Upstream** | Same refactor |
| `docs/SECURITY_EXCEPTIONS.md` | **Upstream** | Identical node-forge section, fuller braces entry with machine-checked mitigations |
| `docs/ACCEPTANCE_MATRIX_V2.md` | **This branch** | All four disagreeing statuses checked individually |

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

| ID | Upstream | Here | Why |
|---|---|---|---|
| `AI-01` | PARTIAL | **PASS** | `scripts/health-model-availability.test.mjs` asserts `/api/health` only reports ok when the configured Ollama models are installed. It runs green. Upstream cited only a client contract test |
| `INBOX-01` | PASS | **PARTIAL** | `TelegramConnector.sync` returns `this.connect(context)`; `connect` only validates credentials. Nothing ingests into the unified conversation model |
| `UI-01` | PARTIAL | **PASS** | Mission Control tests pass with no server-side secrets |
| `REL-02` | PARTIAL | **UNVERIFIED** | No code defect: the pipeline deliberately builds unsigned. Release signing is owner-controlled policy, not a defect to fix |

## Defect the merge introduced

`scripts/node-forge-audit-exception.test.mjs` auto-merged with `BRACES_GHSA`
declared twice — a `SyntaxError`, so the file would not load at all. Both sides
had added the constant. Removing this branch's redundant copy fixed it. This is
the one defect the reconciliation itself created, and it is the reason the
contract scripts were each run individually rather than trusting the suite.

## Verification on the merged tree

| Check | Result |
|---|---|
| `verify:workspace`, `verify:readiness`, `verify:release-docs`, `verify:release`, `verify:ipc`, `verify:omp` | 6/6 PASS |
| `pnpm test` | 524 tests, 4/4 tasks PASS |
| `pnpm typecheck` | 5/5 PASS |
| `scripts/health-model-availability.test.mjs` | PASS |
| `scripts/soak-failure-evidence.test.mjs` | PASS |
| `scripts/braces-audit-exception.test.mjs` | PASS |
| `scripts/node-forge-audit-exception.test.mjs` | PASS (after the fix above) |
| `scripts/release-gate-model.test.mjs` | PASS |
| `scripts/user-guide-contract.test.mjs` | PASS |
| `cargo test` | **DID NOT RUN** — see below |

### Verification gap: the Rust suite could not run

`cargo test` **did not execute** on the merged tree. The build failed with
`LNK1108: cannot write file at 0x0` and `There is not enough space on the disk
(os error 112)`. The `C:` volume was at 100%, with roughly 800 MB free of
390 GB. `cargo clean` released 879 MiB, which was not enough; the space is
being consumed from outside this repository.

This matters because the merge changed `packages/desktop/src-tauri/src/lib.rs`
by roughly 3,000 lines, including the schema v17 migration. The TypeScript
suite, typecheck, and all six governance gates pass, and the workspace gate
does statically check the Rust schema pin at 17 — but **no Rust test has been
run against the merged file.** Treat the desktop native side as unverified
until `cargo test` completes on a machine with free disk space.

## Still open, and genuinely so

These are owner-gated and no code closes them: release signing credentials,
Apple/Google store accounts, TLS certificates for the production host, a
24-hour soak on the exact release SHA (the workflow is actor-gated and needs a
self-hosted runner), and the manual WCAG/RTL audit.
