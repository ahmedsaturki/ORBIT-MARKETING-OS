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
| Queue invariants | IMPLEMENTED | Idempotency, state validation, defensive copies, retry tests |
| Execution orchestrator | IMPLEMENTED | Policy → confirmation → connector → audit → queue |
| Connector contract | IMPLEMENTED | Capability checks, registry, authorization, fixture |
| Telegram native path | IMPLEMENTED | Token validation, approval, rate-limit handling, ambiguous-delivery stop |
| Workspace isolation | IMPLEMENTED | Persisted active workspace, memberships, scoped vault |
| SQLite integrity | IMPLEMENTED | FK enforcement, busy timeout, workspace integrity triggers |
| Migration path | IMPLEMENTED | Migration chain through schema v8 with legacy backfill |
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
| Native SQLite integration | UNVERIFIED | Tests exist; no clean runtime execution evidence yet |
| Connector real-platform E2E | UNVERIFIED | Telegram path exists; controlled live integration evidence still required |
| Browser E2E/accessibility | UNVERIFIED | No successful clean browser run recorded |
| Security/dependency audit | UNVERIFIED | Automated dependency analysis is not yet a completed release gate |
| Performance/soak | UNVERIFIED | Benchmarks and 24h soak not executed |
| Desktop signing | BLOCKED | Signing credentials are intentionally absent; validation builds only |
| Mobile production signing | BLOCKED | Current workflow produces debug validation APK |
| Vercel production deployment | BLOCKED | Connected `orbit-marketing-os` project exists, but recent deployments are ERROR; repository-side config is now canonical and first-deployment-safe, while a committed lockfile is still required |
| Billing/payment | BLOCKED | No commercial payment provider configuration is verified |
| Production launch | BLOCKED | Any applicable UNVERIFIED/BLOCKED runtime or distribution gate prevents release claim |

## Current infrastructure blocker

GitHub Actions jobs for the rebuild branch are being created but can fail before the first step is registered, with no runner allocation metadata. The latest observed CI job (`107742429760`, run `36031898151`) ended `failure` before workflow steps were registered. The same behavior was reproduced previously with a minimal runner probe. This is treated as execution-infrastructure evidence, not source-build evidence.

## Zero-cost verification fallback

A manual self-hosted verification workflow is available at `.github/workflows/self-hosted-verify.yml`. It requires real committed `pnpm-lock.yaml` and `packages/desktop/src-tauri/Cargo.lock` files before execution.

## Release rule

The product must remain in development/validation state until all release-critical gates have current execution evidence. A source change, green-looking YAML, or an artifact that was not produced by a verified gate is not proof of production readiness.
