# ORBIT Product Surface Matrix

Updated: 2026-09-26.

| Surface                            | Implemented        | Verified runtime                                                                                      | Release state   |
| ---------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------- | --------------- |
| Core domain                        | yes                | Main/PR exact-head typecheck/tests/coverage passed                                                    | VERIFIED        |
| Marketing Brain / Strategy         | yes                | Workspace-local persistence and governed strategy commands                                            | PARTIAL         |
| Research Intelligence              | yes                | Native schema v15, commands, evidence rules and Research Studio                                       | PARTIAL         |
| Universal Search + Mission Control | yes                | Workspace-scoped native E2E and bounded deterministic contract                                        | VERIFIED*       |
| Operating graph + governed work    | yes                | Core graph/decision/native persistence plus command/event control                                     | PARTIAL         |
| Opportunities + insights           | yes                | Native persistence and workspace validation                                                           | PARTIAL         |
| Experimentation + Learning         | yes                | Deterministic engine, native persistence, Experiment Studio and governed evidence bridge              | PARTIAL         |
| Operational Event Spine            | yes                | Exact-head tests/native validation passed on merged control-spine line                                | VERIFIED        |
| Command Registry                   | yes                | Exact-head tests/native validation passed on merged control-spine line                                | VERIFIED        |
| Command Dispatcher                 | yes                | Exact-head CI/native/mobile validation passed before merge                                            | VERIFIED        |
| Agent governance                   | yes                | Agent contracts, authorization, native workspace boundaries and tests                                 | PARTIAL         |
| Desktop Tauri shell                | yes                | Native bundles and E2E passed on validated release lines                                              | VERIFIED        |
| Desktop SQLite/vault/backup        | yes                | Rust/native quality gates passed; dedicated real-instance recovery evidence remains consolidated gate | PARTIAL         |
| Desktop campaigns/tasks/CRM/inbox  | yes                | Unit/integration coverage; full real-instance scenario remains                                        | PARTIAL         |
| Web public/PWA                     | yes                | Main CI + live production checks passed                                                               | VERIFIED        |
| Mobile Expo control surface        | yes                | Mobile validation passed on validated release line                                                    | VERIFIED        |
| Telegram connector                 | yes                | Controlled live authorization/delivery evidence remains                                               | UNVERIFIED      |
| LinkedIn connector                 | yes                | Controlled live authorization/publish evidence remains                                                | UNVERIFIED      |
| Facebook connector                 | contract + fixture | No real connector                                                                                     | NOT_IMPLEMENTED |
| Instagram connector                | contract + fixture | No real connector                                                                                     | NOT_IMPLEMENTED |
| WhatsApp connector                 | contract + fixture | No real connector                                                                                     | NOT_IMPLEMENTED |
| TikTok connector                   | contract + fixture | No real connector                                                                                     | NOT_IMPLEMENTED |
| Local Ollama runtime               | yes                | Runtime smoke passed                                                                                  | VERIFIED        |
| Simulation / Dry Run               | yes                | Deterministic read-only policy evaluation tests                                                       | VERIFIED        |
| Execution Replay                   | yes                | Deterministic read-only trace reconstruction tests                                                    | VERIFIED        |
| Policy Packs                       | yes                | Built-in governed policy contracts/tests                                                              | VERIFIED        |
| Platform SDK foundation            | yes                | Manifest validation/unit tests; no arbitrary plugin execution                                         | PARTIAL         |
| CLI operator surface               | yes                | Read-only command list/authorization preview tests                                                    | VERIFIED        |
| MCP operator surface               | yes                | Read-only discovery/authorization preview protocol tests                                              | VERIFIED        |
| Offline licensing                  | yes                | Core/native token and constraint tests                                                                | PARTIAL         |
| Distribution/signing               | pipeline defined   | Build artifacts validated; signatures remain external prerequisite                                    | PARTIAL         |
| Accessibility/RTL baseline         | yes                | Automated structural checks passed; manual conformance audit remains                                  | PENDING         |
| 24-hour stability soak             | harness exists     | No completed 24h evidence                                                                             | UNVERIFIED      |

## Interpretation

A source implementation, fixture, or UI option is not by itself runtime evidence. Each row changes state only when its corresponding acceptance evidence exists.

External platform execution remains intentionally gated. Unsupported platforms are not represented as production integrations merely because their contracts or fixtures exist.