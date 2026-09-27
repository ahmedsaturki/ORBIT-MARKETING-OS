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

## Product priorities carried into agent sessions

- Prefer $0 / free / local-first solutions when they are technically sound; do not add paid services just to remove an engineering inconvenience.
- Build the smallest independent capability that closes a real acceptance gap, then prove it with tests/evidence.
- Preserve ownership of the product and data: avoid unnecessary SaaS lock-in, opaque third-party dependencies, or external services when an owned implementation is practical.
- Optimize for a premium, trustworthy, original product: strong UX and architecture matter, but claims must always follow evidence.
- Treat marketing, automation, AI, CRM, analytics, research, and publishing as one governed operating system rather than disconnected demos.
