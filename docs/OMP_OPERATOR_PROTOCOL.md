# ORBIT + OMP Operator Protocol

Updated: 2026-09-28.

This document is the shared operating contract for ORBIT and the OMP (Oh My Pi) coding agent. It does not replace AGENTS.md; it makes the execution and evidence rules explicit for an agent that can delegate work, inspect code, run browser/runtime checks, and supervise long-running tasks.

## 1. Mission

Treat ORBIT as a real product with a release evidence chain, not as a collection of source files.

The governing chain is:

SPEC → IMPLEMENT → TEST → SECURITY → PERFORMANCE → RECOVERY → REAL-WORLD EVIDENCE → DOCUMENTATION → RELEASE

Never turn an implementation detail into a production claim without the corresponding evidence.

## 2. Mandatory starting context

At the start of a session, and after compaction or a major branch change, inspect these in order:

1. AGENTS.md
2. docs/TARGET_PRODUCT_BLUEPRINT.md
3. docs/ACCEPTANCE_MATRIX_V2.md
4. release/readiness.json
5. docs/RELEASE_SCORECARD.md
6. docs/FINAL_EXTERNAL_ACTIONS.md
7. docs/COMMERCIAL_PRODUCTION_PROVEN_RUNBOOK.md

Then inspect the current Git SHA, branch state, open PRs/issues, and current deployment/CI evidence before making a release decision.

The current release truth is always the machine-readable readiness file plus fresh evidence for the exact SHA. Historical evidence is context, not a substitute for current evidence.

## 3. OMP execution model

Use OMP's delegation primitives deliberately:

- Use task for independent repository investigations or bounded implementation jobs.
- Prefer isolated worktrees for changes that could conflict.
- Give each worker one explicit acceptance target and a required evidence output.
- Use reviewer/advisor capacity to challenge assumptions before merging.
- Use checkpoints/retention when a long task needs resumable context.
- Use browser/runtime tooling for live behavior verification rather than inferring runtime state from source code.
- Keep the parent agent responsible for reconciliation; workers do not redefine release policy.

Recommended worker roles:

| Role | Primary duty | Required output |
| --- | --- | --- |
| Forensics | map current code/evidence and identify real gaps | file/line evidence + gap list |
| Implementer | make one bounded code/doc change | diff + tests |
| Verification | run exact acceptance checks | pass/fail + command + SHA |
| Release auditor | reconcile readiness/scorecard/evidence | machine-readable truth |
| Reviewer | challenge correctness, security, and regressions | findings + disposition |

## 4. Stop/continue rules

Continue autonomously when the task is local, reversible, testable, and does not require owner credentials.

Stop at OWNER_ACTION when evidence requires:

- real platform credentials or real-account authorization;
- payment/billing activation;
- desktop signing/notarization identities;
- mobile store credentials or signing keys;
- manual accessibility/legal review;
- elapsed real-world soak duration;
- external account/device/network access;
- a production rollback operation that requires platform-level control not exposed to the agent.

Do not simulate or fabricate these proofs.

## 5. Evidence states

Use these meanings exactly:

- L0_DESIGNED: contract/design exists.
- L1_IMPLEMENTED: source capability exists.
- L2_VERIFIED: fresh automated/integration/runtime evidence exists.
- L3_PRODUCTION_PROVEN: exact release artifact plus real-world/operational evidence exists.

Never promote a gate merely because:

- a file exists;
- a test is present;
- a prior commit passed;
- a deployment is reachable;
- a fixture exists;
- a source-level contract was added.

## 6. Release-control invariants

- Never weaken or bypass a failed security/quality gate to obtain green CI.
- Never edit release/readiness.json from a lower level to L3 without durable evidence references and a verification timestamp.
- Never claim external connector delivery without a real external identifier/readback.
- Never claim a rollback drill without observing both the rollback and return paths.
- Never claim 24-hour stability from a short soak.
- Never claim store distribution from a locally generated debug package.
- Never expose credentials, cookies, tokens, or private vault material in logs, artifacts, issues, or chat.

## 7. Efficient execution loop

For each remaining gate:

1. Read the acceptance criterion.
2. Search the repository for existing implementation and evidence.
3. Decide whether it is IMPLEMENT, VERIFY, or OWNER_ACTION.
4. Delegate independent investigations in parallel when safe.
5. Implement the smallest complete fix when the gap is local and testable.
6. Run the exact acceptance checks on the exact SHA.
7. Preserve the evidence in CI/artifacts/docs where appropriate.
8. Reconcile the machine-readable readiness record only from verified evidence.
9. Re-run the release truth check.
10. Review the complete diff for security, regressions, and accidental claims.

## 8. Handoff format

Every worker handoff should answer:

- Scope
- Exact commit/branch
- Files changed
- Tests executed
- Runtime evidence
- Remaining risks/blockers
- Whether the result changes readiness state

## 9. Current project priority

Prefer these in order unless fresh evidence changes the ordering:

1. eliminate locally solvable verification gaps;
2. preserve exact-SHA evidence and reproducibility;
3. strengthen failure/recovery paths;
4. make performance evidence measurable and repeatable;
5. make OMP/operator workflows deterministic and resumable;
6. finish owner-controlled external gates only when the necessary credentials/devices/platform controls are actually available;
7. never convert an external prerequisite into a fake done state.

## 10. Reference

OMP is the open-source coding agent from Stencil Labs / can1357/oh-my-pi. It supports first-class subagents/worktrees, browser tooling, persistent code execution, LSP/debugging, and configurable agent roles. This repository should treat OMP as an execution engine; ORBIT's release contract remains authoritative.

See:
- https://github.com/can1357/oh-my-pi
- AGENTS.md
- release/readiness.json