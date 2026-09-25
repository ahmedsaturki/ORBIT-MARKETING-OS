# ORBIT Marketing OS — Release Readiness

## Current production line

The production line is now merged into `main` via PR #10.

- Merge commit: `f52a0d2ec13a639ec760d8bc08a15e1df5b93970`.
- Release branch used for consolidation: `rebuild/orbit-production-final`.
- The repository now carries reproducible `pnpm-lock.yaml` and `packages/desktop/src-tauri/Cargo.lock`.
- Full technical evidence exists for the release-line parent commit; current `main` is being re-verified after the merge.
- No production launch claim is made until current-main deployment/distribution gates are verified.


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

The release-line parent passed the documented hosted technical gate, including reproducible install, dependency audit, workspace sanity, TypeScript, IPC, lint, tests/coverage, runtime smoke, performance smoke, production build, browser E2E, format, and Rust fmt/check/test/clippy.

After consolidation, the Web Deploy workflow on merge commit `f52a0d2ec13a639ec760d8bc08a15e1df5b93970` also passed its Web quality gate. Its deploy stage was credential-gated and skipped the actual deployment because the required Vercel deployment credentials were not available to the workflow.

A dedicated CI change now runs the full production CI on `main` as well as the release branch so the exact default-branch state receives fresh evidence.


## Remaining release gates

- Fresh post-merge `main` full CI evidence.
- Native runtime restart/crash-recovery and persistent queue recovery evidence.
- Full workspace/RBAC negative matrix across all protected IPC surfaces.
- Backup/restore corruption and newer-schema drills.
- Full desktop campaign → content → approval → task scenario.
- Inbox/CRM linkage and encrypted sync convergence across control surfaces.
- Controlled live authorization/runtime evidence for Telegram/LinkedIn.
- Live challenge/human-intervention evidence.
- Desktop validation artifacts for Windows/Linux/macOS.
- Android validation artifact and iOS production distribution/signing.
- Final checksum/provenance verification for distributed artifacts.
- Vercel effective project settings confirmation, guarded production deployment, live verification, and rollback verification.
- Production code signing/notarization where credentials exist.
- Commercial billing/payment configuration and legal/commercial publication review.


## Release rule

No tag, merge, production deployment, or commercial launch claim should be made while required gates remain `UNVERIFIED` or `BLOCKED`.

## Final consolidation checkpoint

The active consolidation head is `db9ffe662b34dbea0d3f8ef1e52a02f6f3b7ca33`. It is synchronized with current `main` history and includes the Linux owner-restricted runner probe. Runtime/release gates remain unverified until an actual runner executes the verification workflow.
