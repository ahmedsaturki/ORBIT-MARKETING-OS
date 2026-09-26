# ORBIT Launch Scorecard

Updated: 2026-09-26.

Legend: IMPLEMENTED = source capability exists; VERIFIED = fresh execution evidence exists; UNVERIFIED = required runtime evidence is missing; PARTIAL = mixed evidence; BLOCKED = external prerequisite prevents completion.

| Gate                                         | State      | Evidence / blocker                                                                                                   |
| -------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------- |
| Core domain/security                         | VERIFIED   | Core architecture, security controls and current hosted quality/native evidence                                      |
| Queue invariants                             | VERIFIED   | Workspace-scoped idempotency, UTC scheduling, bounded retries and defensive handling                                 |
| Execution orchestrator                       | VERIFIED   | Policy → confirmation → connector → audit → queue controls covered by core/native validation                         |
| Workspace isolation                          | VERIFIED   | Persisted active workspace, membership checks and scoped sensitive data                                              |
| SQLite integrity                             | VERIFIED   | FK enforcement, migrations and workspace integrity controls                                                          |
| Migration path                               | VERIFIED   | Versioned schema through v15 with research model                                                                     |
| Operating graph/outcomes                     | VERIFIED   | Strategy/work graph, opportunities, insights and bounded context                                                     |
| Mission Control/control layer                | VERIFIED   | Next actions, simulation, replay, policy packs and grounded knowledge                                                |
| Research Intelligence                        | VERIFIED   | Research briefs/findings, source/evidence rules and native persistence                                               |
| Experimentation/Learning                     | VERIFIED   | Deterministic assignment, aggregation and governed learning bridge                                                   |
| Anomaly detection                            | VERIFIED   | Deterministic descriptive rolling median/MAD signal                                                                  |
| Agent governance                             | VERIFIED   | Workspace-scoped definitions, grants, knowledge scope and autonomy controls                                          |
| Command/Event control spine                  | VERIFIED   | Exact-head CI/native/mobile evidence passed before merge                                                             |
| Universal Search                             | VERIFIED   | Exact-head Windows Native E2E passed after real SQLite escaping fix                                                  |
| Publishing Calendar                          | VERIFIED   | Exact-head desktop/native/mobile validation passed                                                                   |
| Bulk Planner                                 | VERIFIED   | Approval-gated bounded planner logic and validated native feature head                                               |
| Competitive Watch                            | VERIFIED   | Workspace-namespaced sources and public locators only                                                                |
| Desktop UI                                   | VERIFIED   | Current desktop feature surface plus native validation                                                               |
| Web product/PWA                              | VERIFIED   | Web quality/build/E2E and live route checks                                                                          |
| Runtime perimeter                            | VERIFIED   | Local runtime auth/origin/rate-limit and local-AI smoke                                                              |
| Local AI defaults                            | VERIFIED   | Ollama-local runtime smoke                                                                                           |
| Mobile monitoring/control surface            | VERIFIED   | Mobile validation passed on validated release line                                                                   |
| Clean install                                | VERIFIED   | Frozen install with committed lockfiles                                                                              |
| Typecheck/lint/tests/coverage/build          | VERIFIED   | Hosted CI gates passed on current merged feature lineage                                                             |
| Rust quality                                 | VERIFIED   | Rust fmt/check/test/clippy passed on validated release line                                                          |
| Security/dependency audit                    | VERIFIED   | Hosted security and dependency checks passed                                                                         |
| Performance smoke                            | VERIFIED   | Queue throughput smoke passed                                                                                        |
| Browser E2E                                  | VERIFIED   | Playwright/browser gates passed                                                                                      |
| Production web availability                  | VERIFIED   | READY production deployment and live route/header/runtime checks                                                     |
| Production web provenance                    | UNVERIFIED | Current READY deployment predates main=377e86d and current project metadata/provenance still requires reconciliation |
| Native desktop packaging                     | VERIFIED   | All four desktop packaging targets passed on PR #72 exact head                                                       |
| Android debug validation                     | VERIFIED   | Mobile validation produced validated debug artifact                                                                  |
| Native recovery                              | PARTIAL    | Restart/queue recovery E2E exists; consolidated production evidence remains open                                     |
| Real Telegram connector E2E                  | UNVERIFIED | Real-account authorization/delivery evidence required                                                                |
| Real LinkedIn connector E2E                  | UNVERIFIED | Real-account authorization/publish evidence required                                                                 |
| CRDT multi-device network                    | UNVERIFIED | Live multi-device network evidence required                                                                          |
| Accessibility/RTL                            | PARTIAL    | Automated structural checks pass; manual/WCAG audit remains                                                          |
| 24h stability soak                           | UNVERIFIED | No completed 24-hour evidence                                                                                        |
| Desktop signing/notarization                 | BLOCKED    | Signing identities/credentials not configured                                                                        |
| Mobile production signing/store distribution | BLOCKED    | Store credentials/configuration not configured                                                                       |
| Vercel project/settings provenance           | PARTIAL    | Repository contract says Next.js/root/out; connected metadata currently reports Vite/empty provenance                |
| Vercel rollback drill                        | UNVERIFIED | Procedure exists; fresh drill evidence missing                                                                       |
| Governance/main branch protection            | UNVERIFIED | Live protection state cannot be verified with current GitHub integration                                             |
| Billing/payment                              | BLOCKED    | No verified commercial billing provider configured                                                                   |
| Production/commercial launch                 | BLOCKED    | Multiple release-critical L3 gates remain open                                                                       |

## Release rule

Do not claim production ready or commercially final while a required runtime or external release gate remains UNVERIFIED or BLOCKED.
