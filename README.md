# ORBIT MARKETING OS

Local-first social operations platform for content, campaigns, CRM, inbox workflows, analytics, and user-authorized platform integrations.

Current real connector coverage: Telegram has a native API path and LinkedIn has a text-publishing Posts API connector. Both remain release-gated until controlled authorization/runtime evidence exists. Facebook, Instagram, WhatsApp, and TikTok remain contract/fixture surfaces.

## Repository status

The production monorepo architecture is consolidated on `main`; the historical rebuild PRs remain in GitHub only as implementation history.

The current production branch is:

`main`

The rebuild is acceptance-driven: implementation is not considered complete until it has automated tests, integration evidence, security checks, performance evidence, documentation, and a releasable artifact where applicable.

## Product boundary

The product is designed around local ownership of sensitive data. The desktop/local runtime is the source of truth for private account state, campaigns, task queues, CRM records, and audit records. Native SQLite schema is versioned through v13, including the governed marketing operating model, persisted opportunities/insights, workspace-scoped task idempotency, and conservative startup crash recovery.

Platform integrations must remain user-authorized and platform-compliant. The product does not implement fingerprint spoofing, CAPTCHA bypass, anti-abuse evasion, or concealed automation.

## Development

Requirements:

- Node.js 22+
- pnpm 10.17.1
- Rust 1.98.1 for the desktop backend

Bootstrap:

```bash
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

Product north star: [docs/TARGET_PRODUCT_BLUEPRINT.md](docs/TARGET_PRODUCT_BLUEPRINT.md) defines the Strategy → Campaign → Content → Execution → CRM/Inbox → Analytics → Learning operating graph and the staged platform roadmap. The Desktop currently exposes Mission Control, Strategy Studio, Outcomes/Learning, and the Operating Graph as governed local workspace surfaces.

Operating control: [docs/OPERATING_CONTROL.md](docs/OPERATING_CONTROL.md) defines the deterministic Simulation, Replay, and Policy Pack layer used to preview, explain, and govern execution without creating a second execution system.

Launch control: `docs/LAUNCH_SCORECARD.md`

The current web product is live on Vercel; desktop artifacts and Android validation artifacts are built by GitHub Actions. Commercial launch remains gated by signing, real connector E2E, soak/rollback, and billing evidence.

Zero-cost technical verification fallback: `docs/SELF_HOSTED_VERIFICATION.md`

Runner setup and the exact verification order: `docs/SELF_HOSTED_RUNNER.md`
