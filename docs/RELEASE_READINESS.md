# ORBIT Marketing OS — Release Readiness

## Current rebuild

The active implementation branch is `rebuild/orbit-production`. PR #2 remains intentionally open, draft, and unmerged while release evidence is collected.

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
- approval actor identity and reviewer role are validated;
- approval mutations and their audit records are committed atomically;
- audit integrity failure blocks external Telegram execution;
- startup recovery runs once at application startup and is idempotent;
- task scheduling uses normalized UTC timestamps and bounded retry ceilings;
- task idempotency is workspace-scoped with v9→v10 migration support;
- account authorization/session state remains synchronized after upsert;
- media import authorizes before filesystem access;
- Desktop consumes typed `@orbit/core` contracts;
- all tracked TSX files use scoped React element types;
- Vercel installer/ignore scripts fail closed without a reproducible lockfile.

## Current execution evidence

Latest observed hosted GitHub Actions CI on the rebuild line:
- run `36039581003`
- job `107768119208`
- conclusion: `failure`
- no workflow steps were registered before failure; therefore this is not source-level build evidence.

The connected Vercel project has no verified successful deployment. Automatic Git builds are now disabled repository-side; historical rebuild attempts were canceled and the last concrete ERROR deployment failed at the install step because the repository lacked the required lockfile.

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
