# ORBIT Marketing OS — Release Readiness

## Current rebuild

The active consolidation branch is `rebuild/orbit-production-consolidated`. PR #9 is open, draft, and unmerged while release evidence is collected.

## Implemented foundations

- strict TypeScript monorepo baseline with pnpm 10.17.1 + Turborepo;
- `@orbit/core` typed domain contracts, queue logic, approval/execution policy, connector registry, content/media/analytics/automation rules, encryption, redaction, audit integrity, sync primitives, licensing and backup foundations;
- Tauri v2 desktop runtime with native SQLite schema through v10, workspace-scoped persistence, encrypted vault/session storage, campaign/task/CRM/inbox/audit commands and safe startup recovery;
- native Argon2id-derived AES-256-GCM encryption and encrypted local backup/restore;
- Next.js 16 static web/PWA/legal/pricing surface;
- Expo SDK 57 / React Native 0.86 mobile monitoring surface;
- guarded CI, release workflows and zero-cost self-hosted verification fallback.

## Hardening completed in this line

- workspace/RBAC checks are applied before protected mutations/reads;
- approval actor identity is derived from the local runtime user rather than client-supplied actor fields;
- approval mutations and their audit records are committed atomically;
- audit integrity failure blocks external Telegram execution;
- startup recovery runs once at application startup and is idempotent;
- task scheduling uses normalized UTC timestamps;
- task retry ceilings are bounded consistently at 10 across core queue, campaign task factory, native task persistence, and rule-pack execution;
- task idempotency is workspace-scoped with v9→v10 migration support;
- v8 vault migration and v10 task migration use transactional schema changes;
- account authorization/session state remains synchronized after upsert and persisted session presence is reflected in the returned view;
- media import authorizes before filesystem access;
- Desktop consumes typed `@orbit/core` contracts and serializable IPC views;
- IPC verification prevents client-supplied approval actor identity from returning;
- all tracked TSX files use scoped React element types;
- Vercel installer/ignore scripts fail closed without a reproducible lockfile.

## Current execution evidence

Latest observed hosted GitHub Actions CI on the consolidation line:

- run `36053293828`
- jobs `107813972668` (quality) / `107813973170` (Rust quality)
- conclusion: `failure`
- runner_id: `0`
- runner name: empty
- steps: `[]`
- no usable workflow step/log evidence was produced.

The current execution environment cannot generate a reproducible lockfile because pnpm is not installed and the npm registry is unreachable. No fake lockfile is committed. The consolidation branch still requires both lockfiles before release execution.

The connected Vercel project has a verified READY production deployment, but it is the legacy `main` Vite surface, not PR #9. A fresh successful consolidation deployment remains unverified.

## Remaining release gates

- committed, validated `pnpm-lock.yaml` and `packages/desktop/src-tauri/Cargo.lock`;
- clean typecheck/lint/tests/coverage/build;
- clean Rust fmt/check/test/clippy;
- native migration/restart/crash-recovery evidence;
- real authorized connector/platform verification;
- CRDT transport/convergence evidence;
- local AI/resource/failure evidence;
- browser/device E2E + accessibility;
- security/dependency review;
- performance and 24h soak;
- Windows/Linux/macOS packaging plus signing;
- Android/iOS production distribution/signing;
- successful Vercel deployment + rollback verification;
- commercial payment/billing configuration;
- legal/commercial publication review.

## Release rule

No tag, merge, production deployment, or commercial launch claim should be made while required gates remain `UNVERIFIED` or `BLOCKED`.

## Final consolidation checkpoint

The active consolidation head is `db9ffe662b34dbea0d3f8ef1e52a02f6f3b7ca33`. It is synchronized with current `main` history and includes the Linux owner-restricted runner probe. Runtime/release gates remain unverified until an actual runner executes the verification workflow.
