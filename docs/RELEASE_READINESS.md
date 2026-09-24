# ORBIT Marketing OS — Release Readiness

## Current rebuild

The active implementation branch is `rebuild/orbit-production`. PR #2 remains intentionally open and unmerged while release evidence is collected.

## Implemented foundations

- strict TypeScript monorepo baseline with pnpm 10.17.1 + Turborepo;
- `@orbit/core` typed domain contracts, validation, retry policy, queue logic, approval/execution policy, encryption, redaction, audit integrity, Yjs sync primitives, licensing and backup foundations;
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

The current source environment cannot reach GitHub/npm through its shell network, so a real pnpm-lock.yaml was not fabricated. CI is configured to generate and validate a lockfile on a clean runner; that evidence remains blocked by the GitHub Actions runner failure.

A Vercel project `orbit-marketing-os` is connected to this repository and receives deployments from `rebuild/orbit-production`. The current deployment path remains UNVERIFIED for release because Vercel installs are failing at the dependency-metadata fetch stage (`ERR_PNPM_META_FETCH_FAIL`), and the project metadata currently reports `vite` while the intended web app is `packages/web` with Next.js. No production web URL is claimed.



## Licensing checkpoint

Offline commercial licensing is now wired through the Desktop runtime. The application verifies Ed25519-signed tokens against an embedded public key, checks payload/date/account-limit constraints, stores the active token locally, and exposes install/status/remove controls. The private signing key is not stored in Git.

Global multi-device seat counting remains intentionally unclaimed because the current product has no coordinating licensing service.

## Vercel deployment diagnosis

The connected `orbit-marketing-os` project exists, but recent Git deployments are failing at the Vercel build step with `NEXT_NO_VERSION`. The deployment metadata reports framework `vite`, while the repository's Web product is Next.js. The repository now exposes the Next.js version at the monorepo root as a compatibility fallback, but project-level Root Directory/Framework configuration should still point at `packages/web` / Next.js before a release claim.
