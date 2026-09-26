# ORBIT Launch Scorecard

Updated: 2026-09-26

Legend: IMPLEMENTED = source capability exists; VERIFIED = current execution evidence exists; UNVERIFIED = execution evidence is still missing; BLOCKED = an external/product prerequisite prevents completion.

| Gate                                            | State       | Evidence / blocker                                                                                                                                    |
| ----------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core domain/security                            | IMPLEMENTED | Typed domain, queue, policy, RBAC, encryption/redaction, audit integrity                                                                              |
| Queue invariants                                | IMPLEMENTED | Workspace-scoped idempotency, UTC scheduling, bounded retries, defensive copies                                                                       |
| Execution orchestrator                          | IMPLEMENTED | Policy → confirmation → connector → audit → queue                                                                                                     |
| Telegram native path                            | IMPLEMENTED | Token validation, approval, daily/circuit budgets, rate-limit handling, ambiguous-delivery stop                                                       |
| Workspace isolation                             | IMPLEMENTED | Persisted active workspace, memberships, scoped vault                                                                                                 |
| SQLite integrity                                | IMPLEMENTED | FK enforcement, busy timeout, workspace integrity triggers                                                                                            |
| Migration path                                  | IMPLEMENTED | Versioned schema through v13 with legacy backfill, outcome/operating-model migration and transactional migrations                                     |
| Operating graph/outcomes                        | IMPLEMENTED | Strategy/work graph, persisted opportunities/insights, governed links and bounded agent context                                                       |
| Mission Control/control layer                   | IMPLEMENTED | Deterministic next actions, simulation, replay, policy packs, campaign-plan compilation and grounded knowledge context                                |
| Command/Event control spine                     | VERIFIED    | Governed Command Registry + Operational Event Spine merged through PR #47; Command Dispatcher merged through PR #48 with exact-head CI/native/mobile evidence |
| Desktop UI                                      | IMPLEMENTED | Workspace, content, approvals, tasks, CRM, inbox, backup, license, audit                                                                              |
| Web product surface                             | VERIFIED    | Main CI build/E2E passed; production routes independently checked live                                                                                |
| Runtime perimeter                               | VERIFIED    | Auth, origin allowlist, rate limiting and fake-Ollama smoke passed                                                                                    |
| Local AI defaults                               | VERIFIED    | Runtime smoke passed with bounded context and local model default                                                                                     |
| Mobile monitoring                               | VERIFIED    | PR #47 exact-head Mobile Validation passed before merge                                                                                               |
| Clean install                                   | VERIFIED    | Hosted CI passes frozen-install with committed lockfiles                                                                                              |
| Typecheck/lint/tests/coverage/build             | VERIFIED    | Current main CI run 36202057601 passed                                                                                                                 |
| Rust fmt/check/test/clippy                      | VERIFIED    | Current main CI plus PR #48 native validation gates passed                                                                                            |
| Security/dependency audit                       | VERIFIED    | Hosted CI passed secret scan and dependency audit                                                                                                     |
| Performance smoke                               | VERIFIED    | Hosted CI performance smoke passed                                                                                                                    |
| Browser E2E                                     | VERIFIED    | Hosted CI Playwright E2E passed                                                                                                                       |
| Production web deployment                       | VERIFIED*   | Current Vercel production deployment is READY and the public web surface is live                                                                      |
| Native desktop packaging                        | VERIFIED    | PR #48 exact-head Desktop Native Validation passed; current main CI/Web Deploy also pass                                                              |
| Android debug validation                        | VERIFIED    | PR #48 exact-head Mobile Validation passed                                                                                                             |
| Native runtime restart/migration/crash recovery | UNVERIFIED  | Dedicated full desktop runtime acceptance evidence remains                                                                                            |
| Real connector E2E                              | UNVERIFIED  | Telegram/LinkedIn live authorization/delivery evidence remains                                                                                        |
| CRDT encrypted transport/convergence            | VERIFIED*   | Encrypted reconnect/convergence tests passed; live multi-device network evidence remains                                                              |
| Accessibility/RTL audit                         | UNVERIFIED  | Dedicated accessibility audit remains                                                                                                                 |
| 24h soak                                        | UNVERIFIED  | No completed 24-hour soak evidence yet                                                                                                                |
| Desktop signing/notarization                    | BLOCKED     | Signing identities/credentials are not configured                                                                                                     |
| Mobile production signing/store distribution    | BLOCKED     | Current production-store prerequisite is not configured                                                                                               |
| Vercel project/provenance reconciliation        | PARTIAL     | Project metadata reports framework vite while repository contract is Next.js static export; latest READY production deployment has empty Git metadata |
| Vercel rollback drill                           | UNVERIFIED  | Rollback procedure is documented/available but a fresh drill is not evidenced                                                                         |
| Billing/payment                                 | BLOCKED     | No verified commercial payment provider is configured                                                                                                 |
| Governance/main branch protection               | UNVERIFIED  | GitHub branch/ruleset enforcement has not been verified as active                                                                                     |
| Production/commercial launch                    | BLOCKED     | Release-critical runtime, connector, distribution, provenance, governance, and commercial evidence remains open                                       |

## Current verified main evidence

PR #47 head `d48f00e93a60d9c85e191099419f659bc94e64c9` passed:

- CI run 36198100587
- Desktop Native Validation run 36198100491
- Mobile Validation run 36198100618

It was then merged to main as `bd174e7e52a6ba69b4c54618e7a635e90bace611`.

PR #48 exact head `6dccbe5c4efcfeb77c5ff87bda3d5d707b5b0301` passed CI, Desktop Native Validation, and Mobile Validation before merge. Current `main` head is `cea2873db9817d4930662747441b55e1660dd67d`; its CI run 36202057601 and Web Deploy run 36202057689 both passed.

## Current Vercel evidence

Project `orbit-marketing-os` is READY in production and currently reports no grouped runtime errors for the selected 7-day period. The effective project metadata still reports `framework: vite`; the repository contract expects a Next.js static export to `packages/web/out`. The latest READY production deployment has empty Git metadata, so its repository provenance is not treated as verified.

## Release rule

Do not call the product commercially final while applicable runtime, connector, accessibility, soak, rollback, governance, signing, provenance, or billing gates remain open.
