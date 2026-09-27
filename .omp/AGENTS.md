# ORBIT — OMP Native Project Context

Import the repository's canonical standing contract first:

@../AGENTS.md

Then load the ORBIT/OMP execution protocol:

@../docs/OMP_OPERATOR_PROTOCOL.md

## OMP-specific operating convention

- Treat this repository as a production product, not a coding exercise.
- Every implementation task must finish with exact-SHA verification evidence or an explicit OWNER_ACTION handoff.
- Use task/subagents for independent forensics, implementation, verification, and review when that reduces risk or elapsed work.
- Keep parent-agent reconciliation authoritative: workers may recommend but must not redefine release policy.
- Prefer isolated worktrees for conflicting implementation work; preserve committed work until the parent has reviewed the handoff.
- Use browser/runtime execution for runtime claims; source inspection alone is not runtime evidence.
- Never expose credentials, cookies, tokens, private vault data, or signing material.
- Never bypass CAPTCHAs, access controls, anti-abuse controls, or platform safety controls.
- Never convert a missing external prerequisite into a simulated pass.
