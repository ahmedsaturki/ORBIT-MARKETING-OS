# Implementation Status

Updated: 2026-09-24

## Implemented in the rebuild branch

- Production work is isolated on `rebuild/orbit-production`; PR #2 remains open, draft, and unmerged pending release evidence.
- pnpm workspace + Turborepo with a strict TypeScript baseline.
- `@orbit/core` domain model, queue contracts, approval/execution policy, connector contract/registry, sync primitives, audit/redaction, encryption, licensing and backup foundations.
- Tauri v2 desktop backend with native SQLite, Argon2id + AES-256-GCM, encrypted sessions/vault, campaigns/tasks, CRM/inbox, analytics, media metadata, automation rule packs, backup/restore, audit commands and persisted workspaces.
- Native SQLite schema is versioned through v10. Task idempotency is scoped by `(workspace_id, idempotency_key)`; legacy v9 databases are migrated to the v10 table shape transactionally.
- Startup recovery is wired once in Tauri startup, not in every database-open call. Interrupted sync tasks return to `pending`; interrupted external tasks stop in `awaiting_user_action`.
- Approval request/decision paths derive the acting user from local runtime state, validate reviewer roles, and use immediate transactions that include the audit event.
- External Telegram execution now fail-closes when the local audit hash chain is invalid and stops safely on invalid/ambiguous delivery responses.
- Media import checks workspace authorization before touching/hash-reading the requested local file.
- Core and native task scheduling normalize RFC3339 timestamps to UTC and bound retry attempts consistently to a maximum of 10.
- LinkedIn Posts connector defaults to API version `202609`.
- Desktop now consumes typed platform contracts from `@orbit/core` and serializable IPC view types.
- React 19 JSX type drift was removed from all tracked `.tsx` files; the repository verifier now prevents `JSX.Element` from returning.
- PWA service-worker fallback was hardened so failed static asset fetches do not incorrectly return the home document.
- Branch-restricted bootstrap/full-verification workflows are exposed from the default branch for manual execution on an owned runner.

## Verification improvements

- Workspace sanity checks cover duplicate Rust derives, schema v10, workspace-scoped idempotency, transactional migration invariants, startup recovery wiring, forbidden production placeholders, and stale React JSX types.
- IPC verification compares Desktop UI native calls against Tauri commands and rejects client-supplied approval actor identity.
- CI/release workflows require committed `pnpm-lock.yaml` and `packages/desktop/src-tauri/Cargo.lock` and use frozen installs.

## Evidence still required

The following remain `UNVERIFIED` or `BLOCKED` until a real execution environment produces current evidence:

- dependency resolution and committed lockfiles;
- complete TypeScript typecheck, lint, tests, coverage and build;
- Rust fmt/check/test/clippy;
- native SQLite restart/migration integration under a real desktop runtime;
- controlled real-user connector tests and platform authorization/challenge handling;
- CRDT encrypted transport and multi-device convergence;
- local-AI/Ollama execution, resource and failure tests;
- browser/device E2E and accessibility checks;
- release packaging, signing, notarization and store distribution;
- production Vercel deployment and rollback verification;
- security/dependency audit, performance benchmarks and soak testing;
- commercial billing/payment configuration.

## Platform safety

The product deliberately excludes fingerprint spoofing, CAPTCHA bypass, anti-abuse evasion and concealed automation. External actions remain user-authorized, auditable and subject to conservative limits and human intervention.

**Release rule:** implementation is not evidence. No production-release claim is valid until the applicable acceptance and release gates have current execution evidence.
