# ORBIT Launch Scorecard

Updated: 2026-09-25 (post-merge refresh)

The release line is now merged into `main`. Technical gates are tracked from the clean release-line evidence and a new full-CI-on-main gate is being established so the exact default branch receives current execution evidence.

Legend:

- **IMPLEMENTED** = source capability exists and is covered by code/tests where applicable.
- **VERIFIED** = executed in a clean runtime environment with current evidence.
- **UNVERIFIED** = implementation exists but execution evidence is missing.
- **BLOCKED** = external/infrastructure prerequisite prevents execution.

| Gate                             | Current state | Evidence / blocker                                                                                                                                              |
| -------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core domain/security             | IMPLEMENTED   | Typed domain, queue, policy, RBAC, encryption/redaction, audit integrity                                                                                        |
| Queue invariants                 | IMPLEMENTED   | Workspace-scoped idempotency, normalized scheduling timestamps, bounded retries, defensive copies, regression tests                                             |
| Execution orchestrator           | IMPLEMENTED   | Policy → confirmation → connector → audit → queue                                                                                                               |
| Connector contract               | IMPLEMENTED   | Capability checks, registry, authorization, fixture                                                                                                             |
| Telegram native path             | IMPLEMENTED   | Token validation, approval, daily/circuit safety budgets, rate-limit handling, ambiguous/invalid-delivery stop                                                  |
| Workspace isolation              | IMPLEMENTED   | Persisted active workspace, memberships, scoped vault                                                                                                           |
| SQLite integrity                 | IMPLEMENTED   | FK enforcement, busy timeout, workspace integrity triggers                                                                                                      |
| Migration path                   | IMPLEMENTED   | Migration chain through schema v10 with legacy backfill and transactional v8/v10 destructive changes                                                            |
| Desktop UI                       | IMPLEMENTED   | Workspace switching, content, approvals, tasks, CRM, inbox, backup, license, audit                                                                              |
| Web product surface              | IMPLEMENTED   | Next.js static app, pricing, legal, PWA                                                                                                                         |
| Local AI Studio                  | IMPLEMENTED   | Typed local runtime client, chat/content/image UI, loopback-only boundary; execution evidence pending                                                           |
| Mobile monitoring surface        | IMPLEMENTED   | Expo Router monitor + secure runtime token storage                                                                                                              |
| Runtime perimeter                | IMPLEMENTED   | Loopback/local auth model, bearer token, origin allowlist, rate limit                                                                                           |
| Media metadata persistence       | IMPLEMENTED   | Workspace-scoped SQLite metadata, MIME/hash validation, search                                                                                                  |
| Automation rule-pack persistence | IMPLEMENTED   | Schema-versioned JSON, structural validation, confirmation invariant                                                                                            |
| Campaign task analytics          | IMPLEMENTED   | Workspace/campaign scoped native aggregation                                                                                                                    |
| Local AI defaults                | IMPLEMENTED   | llama3.2:3b default, bounded OLLAMA_NUM_CTX=4096                                                                                                                |
| Runtime AI smoke                 | IMPLEMENTED   | Fake-Ollama contract added to runtime smoke                                                                                                                     |
| Clean install                    | VERIFIED   | Committed `pnpm-lock.yaml` and frozen-install evidence from the release-line CI |
| Typecheck/lint/tests/build       | VERIFIED*  | Full release-line technical gate passed; fresh post-merge main CI is being re-run |
| Rust fmt/test/clippy             | VERIFIED*  | Full release-line Rust gate passed; fresh post-merge main CI is being re-run |
| Native SQLite integration        | UNVERIFIED | Automated coverage exists; native restart/crash-recovery drill still pending |
| Connector real-platform E2E      | UNVERIFIED | Telegram/LinkedIn adapters exist; controlled live authorization evidence pending |
| Browser E2E/accessibility        | VERIFIED*  | Browser E2E passed in release-line CI; accessibility audit remains separate |
| Security/dependency audit        | VERIFIED*  | CI audit and repository security scan passed on release line |
| Performance/soak                 | UNVERIFIED | Performance smoke passed; 24h soak remains unexecuted |
| Desktop signing                  | BLOCKED    | Signing credentials unavailable; validation artifacts only |
| Mobile production signing        | BLOCKED    | Store/signing credentials and production distribution remain external |
| Vercel production deployment     | BLOCKED    | Connected project metadata still reports `framework: vite`; current READY deployment is prior main surface; guarded release workflow has not deployed the current main |
| Billing/payment                  | BLOCKED    | No verified commercial payment configuration |
| Production launch                | BLOCKED    | Runtime/distribution/deployment/commercial gates remain open |

## Current infrastructure state

GitHub-hosted runners are now executing jobs normally. Earlier pre-allocation failures are historical and no longer represent the current default-branch state. The active verification gap is post-merge provenance: the exact `main` head needs one complete current run.


## Zero-cost verification fallback

A manual self-hosted verification workflow is available at `.github/workflows/self-hosted-verify.yml`. A separate branch-restricted lockfile bootstrap workflow is available at `.github/workflows/bootstrap-lockfile.yml`; both are restricted to the consolidated production rebuild ref. The self-hosted verification workflow is manual-only; the hosted CI is the normal zero-cost execution path. Both require an actual `self-hosted, x64, linux` runner and the bootstrap flow generates the lockfiles reproducibly.

## Release rule

The product must remain in development/validation state until all release-critical gates have current execution evidence. A source change, green-looking YAML, or an artifact that was not produced by a verified gate is not proof of production readiness.


*Release-line verification is current for the merged source family; a fresh default-branch run is required before treating the exact post-merge `main` commit as independently verified.
