# ORBIT MARKETING OS

Local-first marketing operations platform for content, campaigns, CRM, inbox workflows, and user-authorized platform integrations.

## Repository status

This repository is under active incremental migration from an initial React/Vite/Express prototype to a monorepo architecture.

The current implementation branch is:

`feat/foundation-local-first`

The branch currently contains the shared `@orbit/core` foundation, security boundaries, local database schema, audit logging, retry policy, execution guardrails, and automated tests.

## Product boundary

The product is designed around local ownership of sensitive data. The desktop/local runtime is the source of truth for private account state, campaigns, task queues, CRM records, and audit records.

Platform integrations must remain user-authorized and platform-compliant. The product does not implement fingerprint spoofing, CAPTCHA bypass, anti-abuse evasion, or concealed automation.

## Development

Requirements:

- Node.js 22+
- pnpm 8.x

Bootstrap:

```bash
pnpm install
```

Core checks:

```bash
pnpm --filter @orbit/core test
pnpm --filter @orbit/core typecheck
pnpm --filter @orbit/core build
```

Workspace checks:

```bash
pnpm test:all
pnpm typecheck:all
pnpm build:all
```

## Target structure

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md).
