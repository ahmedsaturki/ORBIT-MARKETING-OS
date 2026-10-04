# ORBIT-MARKETING-OS — FINAL STATE MODEL

**Date:** 2026-10-04
**Verified commit:** `eca75a5e`
**Branch:** `main` (working tree clean)

This is the final deliverable of the re-audit. Every number below was produced
by running the command named beside it, not by reading a prior report.

---

## 1. Four-Part Status

| Dimension | Status | Basis |
|---|---|---|
| **Engineering** | **PASS** | 533 JS tests, 182 Rust tests, typecheck 5/5, clippy `-D warnings` clean, fmt clean, all 10 governance gates green |
| **Product** | **PARTIAL** | 77 of 83 requirements PASS. Three gaps are capability that was never built, not untested code |
| **Release** | **NOT READY** | 0 of 13 release-critical gates at L3_PRODUCTION_PROVEN. The repository's own rule requires all 13 |
| **Owner Gates** | **9 remaining** | Certificates, credentials, store accounts, human review, wall-clock time |

### Overall

> **NOT READY — READY WITH OWNER GATES**

The gap between "engineering-complete" and "released" is entirely external.
No further engineering work can close it.

---

## 2. Requirement Reconciliation

| Status | Count | Meaning |
|---|---|---|
| PASS | 77 | Named evidence exists and executes |
| PARTIAL | 3 | Some evidence exists; a required capability does not |
| UNVERIFIED | 3 | No executing evidence obtainable on this machine |
| **FAIL** | **0** | — |
| **Total** | **83** | |

The previous `REL-02` FAIL was reclassified to UNVERIFIED: the pipeline
deliberately builds unsigned and `docs/DISTRIBUTION.md` documents signing as an
owner-controlled gate. That is policy, not a defect in this repository.

### The three UNVERIFIED rows

| ID | What is missing | Why it cannot be closed here |
|---|---|---|
| `OPS-02` | The 24-hour soak run | `stability-soak.yml` is `workflow_dispatch` on a `self-hosted` runner |
| `REL-03` | A tagged release with checksums | No tag exists; checksums require a real release build |
| `REL-02` | Signed, notarized artifacts | Requires owner-controlled certificates |

### The three PARTIAL rows

| ID | Evidence that exists | What is still missing |
|---|---|---|
| `INBOX-01` | Connector contracts, fixtures, challenge-stop behavior | No connector ingests conversations; `Connector.sync` is a placeholder |
| `DOC-01` | Guide/env-var/loopback contract in CI | Prose and screenshots need human review |
| `DOC-02` | Security exception register enforced by contract | No executed human review of the threat model |

---

## 3. Defects Found and Fixed During This Audit

Each was proven load-bearing by reverting it and observing the failure.

| # | Defect | Class |
|---|---|---|
| 1 | `soak.ts` recorded **requested** minutes as elapsed; a 1-minute run wrote `"minutes": 1440, "ok": true` | Verification asserting what it hadn't measured |
| 2 | Soak harness aborted at ~68 cycles on a claim-timestamp race | Test-harness bug |
| 3 | `pnpm verify:workspace` failed repo-wide in **eleven** workflows since schema v17 | Gate red since 2026-10-04 |
| 4 | Readiness evidence could cite files that no longer exist | Unenforced truth claim |
| 5 | `pnpm audit` exited 1 in **five** workflows since 2026-09-25 | Security gate red |
| 6 | `conversation_upsert` audited under the global workspace, not its argument | Cross-tenant audit write |
| 7 | Duplicate Rust test helpers (`upsert`, `grant`, `assert_unauthorized`) broke a name-uniqueness gate | Naming collision |

Two more were corrected in reporting rather than code: the workflow count was
understated as five (it is eleven), and a prior audit's counts now conflict with
the matrix, so it is marked superseded.

---

## 4. Gates That Were Red and Are Now Green

| Gate | Was | Now |
|---|---|---|
| `pnpm verify:workspace` | Failing repo-wide, 11 workflows | **PASS** |
| `pnpm audit --audit-level=moderate` | Exit 1, 5 workflows | **PASS** (governed `braces` exception) |
| Schema version pins | Expected v16, code at v17 | **Pinned to 17**, proved to bite at 18 |

The `braces` advisory has no upstream patch. Its exception is governed by
`scripts/braces-audit-exception.test.mjs`, which asserts the allowlist contains
exactly two entries, that `braces` is not a shipped dependency, that the pin
matches the latest published version, and that the exception expires after
2026-11-03. The expiry and dependency guards were both proved by forcing them.

---

## 5. Claims From Prior Reporting That Do Not Survive

| Claim | Reality |
|---|---|
| "ALL CONDITIONS SATISFIED" | Unsupported. 0 of 13 gates at L3 |
| "RELEASE READY" | Contradicts the repository's own release rule |
| "1046 tests passing" | Its own parts sum to **1151**; no run produces 1046 |
| "87 requirement IDs" | The matrix defines **83** |
| "609 test files" | Actual: **59** |
| "No engineering changes are needed" | **False** — seven defects were found in code |

---

## 6. What Could Not Be Verified Here

- **Desktop E2E.** WebView2 does not open its CDP port on this host, so the
  boot test cannot attach. Confirmed environmental: the pre-existing boot test
  fails identically with `ECONNREFUSED 127.0.0.1:9340`. Seven matrix rows cite
  these tests and are recorded as **CI-attested, not machine-confirmed**.
- **The 24-hour soak.** Actor-gated, self-hosted runner.
- **Node engine warning.** `Unsupported engine: wanted {"node":">=22 <25"}` on
  a local v26 runtime. Advisory only: no `.npmrc` sets `engine-strict`, CI pins
  Node 22 in all 24 places that use Node, and `rebuild-rust.yml` is Rust-only.
  Every result above was produced on the out-of-range runtime.

---

## 7. Owner Actions to Close Release

1. Run the 24-hour soak on the release SHA (`OPS-02`)
2. Provide desktop signing certificates (`REL-02`)
3. Cut a tagged release to produce checksums (`REL-03`)
4. Supply Telegram and LinkedIn credentials
5. Open mobile store accounts
6. Activate a payment provider
7. Complete legal/commercial publication review
8. Complete the WCAG/RTL accessibility audit
9. Verify multi-device sync with real devices
10. Resolve the SonarCloud new-code rating gap

Items 1–3 and 9–10 are tracked in `release/readiness.json`. SonarCloud is the
only remaining item an engineer can act on without an external resource.

---

## 8. Stop Decision

> **FINAL DELIVERY: NOT READY — READY WITH OWNER GATES**

Engineering is sound and, for the first time in this audit's history, every
gate that can run locally is green. The verification machinery now fails when
it should and passes when it should, which is what makes any future readiness
claim worth reading.

Three rows remain UNVERIFIED and three PARTIAL. None is closable by writing
more code.