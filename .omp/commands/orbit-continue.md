# ORBIT Continue

Continue ORBIT from the current repository state without restarting completed work.

## Required context

Read AGENTS.md, .omp/AGENTS.md, .omp/RULES.md, WATCHDOG.md, WATCHDOG.yml,
docs/OMP_OPERATOR_PROTOCOL.md, release/readiness.json, and docs/ACCEPTANCE_MATRIX_V2.md.

Then inspect the current branch/commit, open PRs/issues, CI checks, runtime/deployment evidence,
and the latest release scorecard.

## Execution

1. Build a gate-by-gate current-state map.
2. For every open gate, classify it as IMPLEMENT, VERIFY, or OWNER_ACTION.
3. Use OMP task agents for independent investigations and bounded implementation work.
4. Use the verifier role after implementation and the reviewer role before merge.
5. Keep the parent session responsible for reconciliation and release truth.
6. Run exact acceptance checks on the exact SHA.
7. Fix real failures immediately; do not paper over them.
8. Update durable evidence only when supported by the exact run.
9. Continue every local IMPLEMENT/VERIFY item until no safe local work remains.
10. Finish with an explicit OWNER_ACTION handoff for anything that genuinely requires external owner control.

## Hard rules

Never:

- claim L3 from source inspection, fixtures, or historical evidence;
- skip security/quality gates;
- fabricate external connector delivery;
- claim a rollback without observing both directions;
- claim 24-hour stability from a shorter soak;
- expose credentials, cookies, tokens, signing keys, or vault contents;
- replace a real missing proof with a synthetic pass.

The desired terminal state is: all locally solvable work complete, all reproducible evidence retained,
all external blockers explicitly isolated, and the release state truthfully represented by the machine-readable contract.
