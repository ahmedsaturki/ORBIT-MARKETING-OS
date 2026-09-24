# ORBIT Operations Runbook

## Local desktop

1. Start from a clean checkout with Node 22+ and pnpm 10.17.1.
2. Run `pnpm install`.
3. Run `pnpm verify:workspace`, then `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`.
4. Run the Tauri application from `packages/desktop`.

The desktop database is stored in the OS application-data directory. Sensitive vault/session material is encrypted by the native runtime.

## Local AI runtime

Run `pnpm runtime:start`. By default it binds to `127.0.0.1`.

Ollama is optional. The runtime accepts Ollama only through loopback HTTP, reports a degraded state when it is unavailable, and rejects remote Ollama targets.

## Mobile control

For same-device/local development, use the localhost runtime address supported by the device environment.

For LAN control, explicitly set a non-loopback `RUNTIME_HOST` and configure `RUNTIME_AUTH_TOKEN`. Mobile stores this token in OS secure storage, not ordinary application storage.

For browser clients, an explicit `RUNTIME_ALLOWED_ORIGINS` entry is required; unconfigured browser origins are rejected even when the runtime is bound to loopback. Do not expose the runtime to the public internet.

## Recovery

Before risky migrations, create an encrypted backup with the desktop backup command.

Restore validates SQLite integrity before replacing the active database. The previous database is retained as a recovery copy during replacement.

If audit verification reports invalid, stop external execution and preserve the database for investigation.

If the execution circuit breaker opens, resolve the underlying connector/account problem before resuming.

## Connector incidents

A challenge or authorization failure is a stop condition. The correct operational action is human intervention and re-authorization, not evasion.

Unsupported capabilities must remain blocked.

## Release

A release starts from a version tag. Desktop artifacts are currently unsigned and accompanied by SHA-256 checksums.

Signed distribution, store submission, production web deployment, and commercial billing remain separate release gates.

## Incident evidence

For any production incident collect, without exposing secrets:

- product version and release tag;
- operating system;
- sanitized runtime/audit output;
- affected task/campaign identifier;
- connector/platform;
- exact failure timestamp;
- whether the circuit breaker or challenge gate activated.

Never attach passwords, session cookies, access tokens, private keys, or raw secret vault contents to bug reports.

### Remote runtime perimeter

When `RUNTIME_HOST` is non-loopback, keep `RUNTIME_AUTH_TOKEN` set and configure `RUNTIME_ALLOWED_ORIGINS` for any browser client. Native/mobile clients without an `Origin` header can still authenticate with the bearer token. `RUNTIME_RATE_LIMIT` defaults to 120 requests per client address per rolling minute; invalid values fall back to the default.
