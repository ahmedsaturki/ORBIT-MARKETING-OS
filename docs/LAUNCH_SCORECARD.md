# ORBIT Marketing OS — Launch Scorecard

> Current release evidence snapshot: 2026-09-26
>
> The repository is using the RC2 release cut plus the governed Operational Event Spine workstream. Older historical references below are retained as provenance; they are not treated as current exact-head evidence.

## Current exact-head verification

- RC2 head: `6dcd7df2f6500214d3c227de281cfca6219b1083`
  - CI: PASS
  - Mobile Validation: PASS
  - Desktop Native Validation: still running at last check; four packaging jobs have passed, Windows native E2E remains active.
- Operational Spine head: `776223186600606803e0c104583f36ab925631b7`
  - CI / Desktop Native / Mobile are running or queued for the current exact head.
  - Previous failures on older heads were traced to stale schema/test assertions and corrected; they are not copied forward as results.
- Operational Event Spine: IMPLEMENTED at source level and persisted in SQLite schema v13; full release verification remains gated on exact-head CI/native evidence.
- Command Registry: IMPLEMENTED and unit-tested; cross-surface runtime usage remains a later integration gate.
- Vercel public web: live production output remains separately verified; project framework metadata cleanup is still external and not inferred as fixed.

## Release rule

No line above is a production-readiness claim while any required exact-head runtime gate remains pending or unverified.


# ORBIT Launch Scorecard

Updated: 2026-09-26

Legend: IMPLEMENTED = source capability exists; VERIFIED = current execution evidence exists; UNVERIFIED = execution evidence is still missing; BLOCKED = an external/product prerequisite prevents completion.

| Gate                                            | State       | Evidence / blocker                                                                                                                                                   |
| ----------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core domain/security                            | IMPLEMENTED | Typed domain, queue, policy, RBAC, encryption/redaction, audit integrity                                                                                             |
| Queue invariants                                | IMPLEMENTED | Workspace-scoped idempotency, UTC scheduling, bounded retries, defensive copies                                                                                      |
| Execution orchestrator                          | IMPLEMENTED | Policy → confirmation → connector → audit → queue                                                                                                                    |
| Telegram native path                            | IMPLEMENTED | Token validation, approval, daily/circuit budgets, rate-limit handling, ambiguous-delivery stop                                                                      |
| Workspace isolation                             | IMPLEMENTED | Persisted active workspace, memberships, scoped vault                                                                                                                |
| SQLite integrity                                | IMPLEMENTED | FK enforcement, busy timeout, workspace integrity triggers                                                                                                           |
| Migration path                                  | IMPLEMENTED | Versioned schema through v13 with legacy backfill, outcome migration, durable operational events and transactional migrations                                                                    |
| Operating graph/outcomes                        | IMPLEMENTED | Strategy/work graph, persisted opportunities/insights, governed links and bounded agent context                                                                      |
| Mission Control/control layer                   | IMPLEMENTED | Deterministic next actions, simulation, replay, policy packs, campaign-plan compilation and grounded knowledge context                                               |
| Desktop UI                                      | IMPLEMENTED | Workspace, content, approvals, tasks, CRM, inbox, backup, license, audit                                                                                             |
| Web product surface                             | VERIFIED    | Main CI build/E2E passed; production routes independently checked live                                                                                               |
| Runtime perimeter                               | VERIFIED    | Auth, origin allowlist, rate limiting and fake-Ollama smoke passed                                                                                                   |
| Local AI defaults                               | VERIFIED    | Runtime smoke passed with bounded context and local model default                                                                                                    |
| Mobile monitoring                               | VERIFIED    | Main/mobile checks passed; Android debug artifact validation is tracked in PR #38                                                                                    |
| Clean install                                   | VERIFIED    | Main CI run 36144303102 passed frozen install with committed lockfiles                                                                                               |
| Typecheck/lint/tests/coverage/build             | VERIFIED    | Main CI run 36144303102 passed all quality steps                                                                                                                     |
| Rust fmt/check/test/clippy                      | VERIFIED    | Main CI run 36144303102 passed all Rust gates                                                                                                                        |
| Security/dependency audit                       | VERIFIED    | Secret scan and high-severity pnpm audit passed in main CI                                                                                                           |
| Performance smoke                               | VERIFIED    | Main CI performance smoke passed                                                                                                                                     |
| Browser E2E                                     | VERIFIED    | Main CI Playwright E2E passed                                                                                                                                        |
| Production web deployment                       | VERIFIED*   | Live Vercel production alias is READY and public routes/headers/404 were checked                                                                                     |
| Native desktop packaging                        | PARTIAL     | PR #38: exact-head native bundle validation is active; no final bundle PASS is recorded until the current run settles                                                |
| Android debug validation                        | PARTIAL     | PR #38 inherited a passing mobile preparation path, but no Android artifact PASS is claimed for the current exact head until its current-head validation is recorded |
| Native runtime restart/migration/crash recovery | UNVERIFIED  | Dedicated full desktop runtime acceptance evidence remains                                                                                                           |
| Real connector E2E                              | UNVERIFIED  | Telegram/LinkedIn live authorization/delivery evidence remains                                                                                                       |
| CRDT encrypted transport/convergence            | VERIFIED*   | PR #29 merged encrypted disconnect/reconnect convergence + wrong-key replay regression; live multi-device network evidence remains                                   |
| Accessibility/RTL audit                         | UNVERIFIED  | Functional E2E is green; dedicated accessibility audit remains                                                                                                       |
| 24h soak                                        | UNVERIFIED  | Performance smoke is green; 24-hour soak is not yet evidenced                                                                                                        |
| Desktop signing/notarization                    | BLOCKED     | Signing identities/credentials are not configured                                                                                                                    |
| Mobile production signing/store distribution    | BLOCKED     | Current path is Android debug validation only                                                                                                                        |
| Billing/payment                                 | BLOCKED     | No verified commercial payment provider is configured                                                                                                                |
| Production/commercial launch                    | BLOCKED     | Release-critical evidence and distribution gates remain open                                                                                                         |

## Current verified main evidence

Latest fully passing main CI baseline: 88c160344d5dd509617867e9d9518f80f332543b

Main CI run 36144303102 completed successfully and executed the lockfile, release sanity, security scan, dependency audit, workspace sanity, typecheck, IPC, lint, tests, coverage, runtime smoke, performance smoke, build, Playwright E2E, format check, Rust fmt/check/test/clippy gates.

Main Web Deploy run 36144303202 passed the Web quality gate. Its deploy stage was skipped because repository Vercel secrets are not configured; live Vercel production is separately verified.

## Current native cut evidence

PR #38 (`b0ee492275b9cd56353a3bcfcb6e2499820da7af`) is the current exact-head validation cut. The authoritative CI/Rust/native result for this head is still being collected; prior parent-commit artifact results are not copied forward as exact-head PASS evidence.

## Production web evidence

Vercel project orbit-marketing-os has a READY production deployment and orbit-marketing-os.vercel.app serves the current ORBIT web surface.

Live checks returned HTTP 200 for the home page, pricing, privacy, terms, refunds, EULA, manifest and service worker. An unknown route returned HTTP 404. HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP and CORP were observed.

*Vercel project metadata still reports framework vite even though the repository-side product contract is a Next.js static export. The live output is verified; exact project-setting alignment remains a cleanup item.

## Release rule

Do not call the product commercially final while applicable signing, real connector, accessibility, soak, rollback or billing gates remain open.
