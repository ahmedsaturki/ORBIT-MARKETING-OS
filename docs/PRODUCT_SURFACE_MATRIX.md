# ORBIT Product Surface Matrix

Updated: 2026-09-25

| Surface                           | Implemented        | Verified runtime                                                                               | Release state   |
| --------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------- | --------------- |
| Core domain                       | yes                | Main CI typecheck/tests/coverage passed                                                        | VERIFIED        |
| Mission Control + Strategy Studio | yes                | Desktop surfaces wired to workspace-local runtime state and governed strategy/outcome commands | PARTIAL         |
| Operating graph + governed work   | yes                | Core graph/decision tests + native persistence contracts added in PR #39                       | PARTIAL         |
| Opportunities + insights          | yes                | v12 migration/validation exists; full product E2E remains                                      | PARTIAL         |
| Desktop Tauri shell               | yes                | Native packaging + native E2E validation is running in PR #38                                  | PARTIAL         |
| Desktop SQLite/vault/backup       | yes                | Rust test suite passed; dedicated real-instance recovery drill remains                         | PARTIAL         |
| Desktop campaigns/tasks/CRM/inbox | yes                | Main unit/integration coverage passed; full real-instance scenario remains                     | PARTIAL         |
| Web public/PWA                    | yes                | Main CI + live Vercel route/header/404 verification passed                                     | VERIFIED        |
| Mobile Expo control surface       | yes                | Main mobile checks passed; Android debug artifact validation is running in PR #38              | PARTIAL         |
| Telegram connector                | yes                | Controlled live authorization/delivery evidence remains                                        | UNVERIFIED      |
| Facebook connector                | contract + fixture | No real connector                                                                              | NOT_IMPLEMENTED |
| Instagram connector               | contract + fixture | No real connector                                                                              | NOT_IMPLEMENTED |
| WhatsApp connector                | contract + fixture | No real connector                                                                              | NOT_IMPLEMENTED |
| LinkedIn connector                | yes                | Controlled live authorization/publish evidence remains                                         | UNVERIFIED      |
| TikTok connector                  | contract + fixture | No real connector                                                                              | NOT_IMPLEMENTED |
| Local Ollama runtime              | yes                | Main runtime smoke passed against fake local Ollama                                            | VERIFIED        |
| Offline licensing                 | yes                | Main tests cover token/constraints; native distribution verification remains                   | PARTIAL         |
| Distribution/signing              | pipeline defined   | Validation artifacts are available; signing remains external                                   | PARTIAL         |
| Accessibility/RTL baseline        | yes                | Automated Playwright structural checks added in this branch                                    | PENDING         |
| 24-hour stability soak            | yes                | Workflow/harness exists; no completed 24h evidence yet                                         | UNVERIFIED      |

## Important interpretation

A UI option, type, fixture, or pipeline definition is not evidence of a working production integration. Each row changes state only when its corresponding acceptance evidence exists.

The current repository intentionally supports a public/product surface before every external connector is implemented. Release artifacts and public documentation must not imply unsupported platform integrations are production-ready.

The matrix distinguishes source/unit evidence from clean native runtime evidence and controlled live external integration evidence.
