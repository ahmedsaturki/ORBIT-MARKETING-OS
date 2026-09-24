# ORBIT Marketing OS — Release Readiness

## Current rebuild

The active implementation branch is `rebuild/orbit-production`. PR #2 remains intentionally open and unmerged while release evidence is collected.

## Implemented foundations

- strict TypeScript monorepo baseline with pnpm 10.17.1 + Turborepo;
- `@orbit/core` typed domain contracts, validation, retry policy, queue logic, approval/execution policy, content/media/analytics/automation rules, encryption, redaction, audit integrity, Yjs sync primitives, licensing and backup foundations;
- Tauri v2 desktop runtime with native SQLite, schema migration/versioning, workspace-scoped persistence, encrypted vault/session storage, campaign/task/CRM/inbox/audit commands;
- native Argon2id-derived AES-256-GCM encryption and encrypted local backup/restore;
- Next.js 16 static web/PWA/legal/pricing surface with flat-config ESLint;
- Expo SDK 57 / React Native 0.86 mobile monitoring surface with configuration smoke tests;
- guarded CI and release-gate documentation.

## Newly implemented hardening

- Desktop workspace context is persisted locally and scoped through a workspace membership table.
- Sensitive Desktop IPC commands now enforce the local workspace role before mutating or revealing protected data.
- Encrypted vault records are workspace-scoped with a composite workspace-and-label key and migration support.
- Audit writes use serialized SQLite transactions to preserve the tamper-evident hash chain under concurrent commands.
- The repository root legacy UI is now a safe compatibility shell, preventing the old prototype from being mistaken for the production surface.

## Evidence still required

The following remain `UNVERIFIED` until executed in a clean environment:

- reproducible clean checkout install and lockfile generation/validation;
- full TypeScript typecheck, lint, tests, build, and format check;
- Rust fmt, check, test, and clippy against the Tauri runtime;
- native SQLite migration/restart/crash-recovery integration, including v8 workspace-scoped vault migration;
- persistent queue recovery and idempotency tests through the actual desktop runtime;
- controlled connector fixtures plus real user-authorized integrations; see `docs/CONNECTOR_MATRIX.md` for the evidence boundary.
- challenge/authentication stop and human-intervention flows;
- encrypted CRDT transport and multi-device convergence;
- content/media indexing and local AI/Ollama failure/resource handling;
- browser E2E and accessibility verification;
- Android/iOS release artifacts, Windows/Linux/macOS packaging and signing;
- production web deployment and rollback verification;
- security/dependency review, performance benchmarks, and 24-hour soak evidence;
- commercial billing/payment configuration.

## Platform safety

ORBIT does not implement fingerprint spoofing, CAPTCHA bypass, anti-abuse evasion, or concealed automation. External actions must remain user-authorized and platform-compliant.

## Release rule

No production-ready or commercial-launch claim is valid until every applicable gate in `docs/ACCEPTANCE_MATRIX_V2.md` and `docs/RELEASE_GATES.md` has current evidence.


## Current verified repository facts

The rebuild branch currently contains the intended CI, Rust, release-desktop, and release-mobile workflow definitions, but the latest Actions runs are still failing before any workflow step executes; GitHub reports completed failed jobs with no step records. This is tracked as an execution-infrastructure blocker, not treated as evidence of a source-level build failure.

The current source environment cannot reach GitHub/npm through its shell network, so a real pnpm-lock.yaml was not fabricated. The normal CI and release workflows require a committed lockfile and use frozen installs. A separate, branch-restricted self-hosted bootstrap workflow/script exists to generate the lockfile; that bootstrap evidence is still pending.

A Vercel project `orbit-marketing-os` exists. Repository-side deployment configuration is canonical at the repository root: Next.js, `pnpm install --frozen-lockfile`, `pnpm --dir packages/web build`, and `packages/web/out`. Recent concrete deployments reached Vercel's configuration/ignore stage and failed before a usable deployment was established; the repository-side `ignoreCommand` was subsequently hardened and moved into `scripts/vercel-ignore.sh`. A fresh successful deployment is still required to verify the effective project settings.



## Licensing checkpoint

Offline commercial licensing is now wired through the Desktop runtime. The application verifies Ed25519-signed tokens against an embedded public key, checks payload/date/account-limit constraints, stores the active token locally, and exposes install/status/remove controls. The private signing key is not stored in Git.

Global multi-device seat counting remains intentionally unclaimed because the current product has no coordinating licensing service.

## Vercel deployment diagnosis

The connected `orbit-marketing-os` project exists, but no successful deployment has been verified yet. The two latest concrete repository-side configuration failures observed were an overlong `ignoreCommand` and then a `fatal: bad revision ''` caused by missing Git revision environment variables. Both were fixed in the repository configuration, but a fresh deployment has not yet been established. Deployment metadata has also reported project framework `vite`, while the repository contract targets the `packages/web` Next.js static export; this remains an external project-setting verification item.

## Current Vercel state

The connected Vercel project is `orbit-marketing-os`. The repository configuration is now explicitly Next.js static export with `packages/web/out` and a versioned first-deployment-safe ignore script. A fresh successful deployment is still required before release.

## Latest execution snapshot
The default branch now also exposes branch-restricted `Bootstrap pnpm lockfile` and `Self-Hosted Verification` workflow definitions so their manual `workflow_dispatch` controls are available from GitHub's Actions UI. Both workflows refuse refs other than `rebuild/orbit-production`.


- Branch HEAD: `c054125d43c0f215a34c71f08f09b1acbf34b2f6`.
- PR #2 remains open, draft, and unmerged.
- The latest hosted `CI` run for the branch completed with `failure` before workflow steps were registered.
- The latest lockfile bootstrap run for the branch remains `queued`; previous bootstrap runs were cancelled by its concurrency policy.
- No production deployment is being claimed from these states.

The implementation branch now includes local content variants, media metadata/import/delete lifecycle, versioned automation rule packs with confirmation invariants and runtime limits, campaign-scoped analytics, current LinkedIn Posts API version defaults, normalized task scheduling timestamps with bounded retries, synchronized account authorization state, and expanded acceptance/verification coverage.
