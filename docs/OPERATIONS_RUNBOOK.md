# ORBIT Marketing OS — Operations Runbook

## Product surfaces

- Desktop: Tauri v2 local execution surface and system of record for sensitive operational data.
- Web: Next.js static public/product surface in packages/web.
- Mobile: Expo monitoring/control surface; heavy execution remains local to Desktop/runtime.

## Local first-run

1. Install Node 22.x and pnpm 10.17.1.
2. Run pnpm install.
3. Run pnpm verify:workspace.
4. Run pnpm typecheck.
5. Run pnpm test.
6. Run pnpm build.
7. Run pnpm format:check.
8. Run pnpm runtime:start for the local HTTP runtime.

## Data and workspaces

SQLite and encrypted local files live in the OS application-data directory.
The runtime creates a default workspace and local owner membership.
Workspace switching is persisted locally. Protected IPC commands require an active workspace membership and role.

## External platform actions

External actions remain user-authorized and platform-compliant.
The execution path uses task validation, campaign/account/platform consistency, approvals, explicit confirmation, daily limits, circuit breakers, connector capability checks, challenge handling, and audit logging.
Fingerprint spoofing, CAPTCHA bypass, anti-abuse evasion, and concealed automation are not implemented.

## Telegram safety

Bot tokens are validated and kept out of audit metadata.
HTTP 429 responses reschedule tasks with RFC3339 timestamps.
Authentication failures move the account to needs_refresh.
Ambiguous transport failures move the task to awaiting_user_action instead of blind retry, preventing possible duplicate sends.

## Backup and restore

Backups contain encrypted SQLite snapshots.
Restore validates SQLite integrity before swapping databases and cleans temporary recovery artifacts.
Independent restore drills remain part of release verification.

## Audit integrity

Native audit writes use serialized SQLite transactions and SHA-256 chaining.
The Desktop exposes audit_list and audit_verify.

## Local AI

The runtime defaults to llama3.2:3b with OLLAMA_NUM_CTX=4096. Both are configurable.
Ollama is optional at runtime; the application must fail into a degraded state rather than requiring a cloud AI service.

## CI and release

GitHub Actions is the clean-environment verification path.
Current repository infrastructure issue: jobs may fail before the first workflow step is registered. This is tracked as an execution-infrastructure blocker.
Validation prereleases are unsigned and must not be presented as production builds.
Production release requires current evidence for install, tests, build, Rust quality, runtime recovery, connector E2E, security, performance, signed artifacts, web deployment, mobile signing, rollback, and commercial billing configuration where applicable.

## Vercel

The intended Vercel web project root is the repository root and the framework is Next.js.
The repository keeps one canonical Vercel configuration at the repository root (`vercel.json`).
Project-level Root Directory and Framework settings must be verified before a production web claim.

## Incident rule

Missing evidence means UNVERIFIED.
Implementation is not runtime evidence.
