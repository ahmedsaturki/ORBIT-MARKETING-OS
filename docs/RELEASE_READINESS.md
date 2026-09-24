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

## Evidence still required

The following remain `UNVERIFIED` until executed in a clean environment:

- reproducible clean checkout install and lockfile generation/validation;
- full TypeScript typecheck, lint, tests, build, and format check;
- Rust fmt, check, test, and clippy against the Tauri runtime;
- native SQLite migration/restart/crash-recovery integration;
- persistent queue recovery and idempotency tests through the actual desktop runtime;
- controlled connector fixtures plus real user-authorized integrations;
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
