# ORBIT Current Verification Snapshot — 2026-09-24

Source implementation head at snapshot: "8904f23766b502525bbcb7d3dee825687ff914f0"

## Live repository state

- Active branch: `rebuild/orbit-production-consolidated`
- PR #9: open, draft, unmerged
- Latest hosted CI run: the latest hosted jobs still fail before usable workflow step execution.
- Latest hosted CI result: job failed before any workflow steps executed; no usable runner step evidence
- Active self-hosted verification run: a fresh push-triggered run is expected for the final consolidated head after this documentation sync.
- Self-hosted job: `107820579765`
- Self-hosted status: queued for an eligible runner
- Workflow steps registered: none yet
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
- License install/delete mutations are atomic with audit-chain append.
- Native conversation upsert returns the persisted message count.
- Compatibility-shell formatting cleanup.
- Repository-wide secret-pattern/tree scan found no tracked private-key/credential files; only `.env.example` matched the sensitive filename allowlist.

## CI/release infrastructure

- Branch-restricted bootstrap and full self-hosted verification workflows are exposed from `main` for manual dispatch and accept the approved rebuild refs, including `rebuild/orbit-production-consolidated`.
- GitHub-hosted runner allocation remains the current execution blocker.
- Current repository contains no committed `pnpm-lock.yaml` or `packages/desktop/src-tauri/Cargo.lock`.

## Vercel

- Project: `orbit-marketing-os`.
- Automatic Git builds are disabled repository-side.
- Historical concrete rebuild deployment: ERROR during `bash scripts/vercel-install.sh` because `pnpm-lock.yaml` was absent.
- Repository contract remains Next.js static export to `packages/web/out`.
- Effective Vercel project framework/Root Directory still require external verification.
- Successful guarded prebuilt production deployment and rollback remain unverified.
- Vercel project-setting mutation is not executable through the connected tool: its declared schema requires `projectId`, while the backend reports an incompatible `idOrName` expectation.

## Remaining release gates

1. Real dependency resolution + committed `pnpm-lock.yaml` and `Cargo.lock`.
2. Clean TypeScript/Rust/runtime/browser/device execution evidence.
3. Real authorized connector/platform verification.
4. Security/dependency audit, performance benchmarks, and soak.
5. Desktop/mobile signing and production distribution.
6. Successful Vercel prebuilt deployment + rollback test.
7. Commercial billing/payment and final legal/commercial review.

No production-ready, signed, commercial-launch, or successful-deployment claim is made without fresh evidence.
