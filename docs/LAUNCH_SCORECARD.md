# ORBIT Launch Scorecard

Updated: 2026-09-24 (latest evidence refresh)

Legend:

- **IMPLEMENTED** = source capability exists and is covered by code/tests where applicable.
- **VERIFIED** = executed in a clean runtime environment with current evidence.
- **UNVERIFIED** = implementation exists but execution evidence is missing.
- **BLOCKED** = external/infrastructure prerequisite prevents execution.

| Gate | Current state | Evidence / blocker |
|---|---|---|
| Core domain/security | IMPLEMENTED | Typed domain, queue, policy, RBAC, encryption/redaction, audit integrity |
| Queue invariants | IMPLEMENTED | Workspace-scoped idempotency, normalized scheduling timestamps, bounded retries, defensive copies, regression tests |
| Execution orchestrator | IMPLEMENTED | Policy → confirmation → connector → audit → queue |
| Connector contract | IMPLEMENTED | Capability checks, registry, authorization, fixture |
| Telegram native path | IMPLEMENTED | Token validation, approval, daily/circuit safety budgets, rate-limit handling, ambiguous/invalid-delivery stop |
| Workspace isolation | IMPLEMENTED | Persisted active workspace, memberships, scoped vault |
| SQLite integrity | IMPLEMENTED | FK enforcement, busy timeout, workspace integrity triggers |
| Migration path | IMPLEMENTED | Migration chain through schema v10 with legacy backfill and transactional v8/v10 destructive changes |
| Desktop UI | IMPLEMENTED | Workspace switching, content, approvals, tasks, CRM, inbox, backup, license, audit |
| Web product surface | IMPLEMENTED | Next.js static app, pricing, legal, PWA |
| Local AI Studio | IMPLEMENTED | Typed local runtime client, chat/content/image UI, loopback-only boundary; execution evidence pending |
| Mobile monitoring surface | IMPLEMENTED | Expo Router monitor + secure runtime token storage |
| Runtime perimeter | IMPLEMENTED | Loopback/local auth model, bearer token, origin allowlist, rate limit |
| Media metadata persistence | IMPLEMENTED | Workspace-scoped SQLite metadata, MIME/hash validation, search |
| Automation rule-pack persistence | IMPLEMENTED | Schema-versioned JSON, structural validation, confirmation invariant |
| Campaign task analytics | IMPLEMENTED | Workspace/campaign scoped native aggregation |
| Local AI defaults | IMPLEMENTED | llama3.2:3b default, bounded OLLAMA_NUM_CTX=4096 |
| Runtime AI smoke | IMPLEMENTED | Fake-Ollama contract added to runtime smoke |
| Clean install | UNVERIFIED | Requires clean checkout execution and lockfile evidence |
| Typecheck/lint/tests/build | BLOCKED | GitHub hosted runner currently fails before steps; zero-cost self-hosted verification workflow is available |
| Rust fmt/test/clippy | BLOCKED | Same runner-allocation failure |
| Native SQLite integration | UNVERIFIED | Tests exist; no clean native runtime execution evidence yet |
| Connector real-platform E2E | UNVERIFIED | Telegram/LinkedIn paths exist; controlled live/API evidence still required |
| Browser E2E/accessibility | UNVERIFIED | Tests are present; no successful clean browser run recorded |
| Security/dependency audit | UNVERIFIED | Static source scan clean for critical patterns; automated dependency analysis not completed |
| Performance/soak | UNVERIFIED | Benchmarks and 24h soak not executed |
| Desktop signing | BLOCKED | Signing credentials are intentionally absent; validation builds only |
| Mobile production signing | BLOCKED | Current workflow produces debug validation APK |
| Vercel production deployment | BLOCKED | A READY production deployment exists for legacy `main`; rebuild deployment is still unverified. Repository-side rebuild config uses guarded prebuilt deployment |
| Billing/payment | BLOCKED | No commercial payment provider configuration is verified |
| Production launch | BLOCKED | Any applicable UNVERIFIED/BLOCKED runtime or distribution gate prevents release claim |

## Current infrastructure blocker

The latest consolidation CI run `36053293828` created jobs `107813972668` and `107813973170`; both failed before any workflow step executed with no usable step records. Earlier runs in the same series also show the runner allocation pattern. This is execution-infrastructure evidence, not source-build evidence.

## Zero-cost verification fallback

A manual self-hosted verification workflow is available at `.github/workflows/self-hosted-verify.yml`. A separate branch-restricted lockfile bootstrap workflow is available at `.github/workflows/bootstrap-lockfile.yml`; both accept the consolidated production rebuild ref. Both require an actual `self-hosted, x64, linux` runner and the bootstrap flow generates the lockfiles reproducibly.

## Release rule

The product must remain in development/validation state until all release-critical gates have current execution evidence. A source change, green-looking YAML, or an artifact that was not produced by a verified gate is not proof of production readiness.
