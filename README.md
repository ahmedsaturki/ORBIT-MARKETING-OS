# ORBIT MARKETING OS

Local-first social operations platform for content, campaigns, CRM, inbox workflows, analytics, and user-authorized platform integrations.

Current real connector coverage: Telegram has a native API path; Facebook, Instagram, WhatsApp, LinkedIn, and TikTok remain contract/fixture surfaces until their real authorization and E2E gates are satisfied.

## Repository status

This repository is under active incremental migration from an initial React/Vite/Express prototype to a production monorepo architecture.

The production rebuild branch is:

`rebuild/orbit-production`

The rebuild is acceptance-driven: implementation is not considered complete until it has automated tests, integration evidence, security checks, performance evidence, documentation, and a releasable artifact where applicable.

## Product boundary

The product is designed around local ownership of sensitive data. The desktop/local runtime is the source of truth for private account state, campaigns, task queues, CRM records, and audit records.

Platform integrations must remain user-authorized and platform-compliant. The product does not implement fingerprint spoofing, CAPTCHA bypass, anti-abuse evasion, or concealed automation.

## Development

Requirements:

- Node.js 22+
- pnpm 10.17.1
- Rust stable for the desktop backend

Bootstrap:

```bash
bash ./scripts/bootstrap-lockfile.sh
pnpm install --frozen-lockfile
```

Core checks:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm format:check
```

## Quality gates

A feature is not release-complete merely because its source code exists. Release evidence must cover:

- type safety
- unit/integration/E2E tests
- security and data-isolation invariants
- error and recovery paths
- performance budgets
- accessibility and RTL behavior
- packaging and installation
- release and rollback behavior
- documentation

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/ACCEPTANCE_MATRIX_V2.md](docs/ACCEPTANCE_MATRIX_V2.md), and [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md).


Launch control: `docs/LAUNCH_SCORECARD.md`

Zero-cost technical verification fallback: `docs/SELF_HOSTED_VERIFICATION.md`
