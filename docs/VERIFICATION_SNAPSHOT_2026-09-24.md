# ORBIT Current Verification Snapshot — 2026-09-24

Source implementation head at snapshot: "289c67620089a990dcd83572d1d4e1c61bd2e5e7"

## Live repository state

- Active branch: `rebuild/orbit-production`
- PR #2: open, draft, unmerged
- Latest hosted CI run: `36047914345`
- Latest CI job: `107795977054` (Rust) / `107795977291` (quality)
- Latest CI conclusion: `failure`
- Runner metadata: `runner_id=0`, runner name empty
- Workflow steps registered: none
- Interpretation: runner allocation/execution infrastructure failure; no TypeScript/Rust/test result is implied.

## Local execution environment

- Node.js: `v22.16.0`
- npm: `10.9.2`
- Corepack: `0.32.0`
- pnpm: not installed
- npm registry DNS/network: unavailable from this execution environment
- pnpm cache: no local package/cache entry available
- Result: no reproducible `pnpm-lock.yaml` or `Cargo.lock` is fabricated.

## Source hardening completed in this line

- Native SQLite schema v10 with workspace-scoped task idempotency.
- v10 task migration guarded by version check and wrapped in a transaction.
- Workspace/RBAC enforcement and runtime-derived approval identity.
- Atomic approval + audit transactions.
- Audit-integrity fail-closed external Telegram execution.
- Invalid/ambiguous Telegram delivery responses park in human-intervention state.
- UTC-normalized native/core task scheduling and bounded retry budgets across rule-pack, native, and core queue layers.
- Account authorization/session state synchronization after upsert.
- Typed/serializable desktop IPC views and stronger IPC verification.
- LinkedIn connector default API version `202609`.
- Compatibility-shell formatting cleanup.
- Repository-wide secret-pattern/tree scan found no tracked private-key/credential files; only `.env.example` matched the sensitive filename allowlist.

## CI/release infrastructure

- Branch-restricted bootstrap and full self-hosted verification workflows are exposed from `main` for manual dispatch while remaining restricted to `rebuild/orbit-production`.
- GitHub-hosted runner allocation remains the current execution blocker.
- Current repository contains no committed `pnpm-lock.yaml` or `packages/desktop/src-tauri/Cargo.lock`.

## Vercel

- Project: `orbit-marketing-os`.
- Automatic Git builds are disabled repository-side.
- Historical concrete rebuild deployment: ERROR during `bash scripts/vercel-install.sh` because `pnpm-lock.yaml` was absent.
- Repository contract remains Next.js static export to `packages/web/out`.
- Effective Vercel project framework/Root Directory still require external verification.
- Successful guarded prebuilt production deployment and rollback remain unverified.

## Remaining release gates

1. Real dependency resolution + committed `pnpm-lock.yaml` and `Cargo.lock`.
2. Clean TypeScript/Rust/runtime/browser/device execution evidence.
3. Real authorized connector/platform verification.
4. Security/dependency audit, performance benchmarks, and soak.
5. Desktop/mobile signing and production distribution.
6. Successful Vercel prebuilt deployment + rollback test.
7. Commercial billing/payment and final legal/commercial review.

No production-ready, signed, commercial-launch, or successful-deployment claim is made without fresh evidence.
