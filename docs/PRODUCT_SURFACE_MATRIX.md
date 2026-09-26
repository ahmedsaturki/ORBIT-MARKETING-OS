# ORBIT Product Surface Matrix

Updated: 2026-09-26

| Surface                           | Implemented        | Verified runtime                                                                                    | Release state   |
| --------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------- | --------------- |
| Core domain                       | yes                | Main/PR exact-head typecheck/tests/coverage passed                                                  | VERIFIED        |
| Mission Control + Strategy Studio | yes                | Desktop surfaces wired to workspace-local runtime state and governed strategy/outcome commands      | PARTIAL         |
| Operating graph + governed work   | yes                | Core graph/decision/native persistence plus governed event/command controls through PR #47          | PARTIAL         |
| Opportunities + insights          | yes                | v14 migration/validation exists; full product E2E remains                                           | PARTIAL         |
| Experimentation + Learning        | yes                | Core deterministic engine, native schema v14, Experiment Studio and governed command/event boundary               | PARTIAL         |
| Operational Event Spine           | yes                | Exact-head tests/native validation passed in PR #47                                                 | VERIFIED        |
| Command Registry                  | yes                | Exact-head tests/native validation passed in PR #47                                                 | VERIFIED        |
| Command Dispatcher                | yes                | PR #48 exact-head CI/native/mobile validation passed; current `main` contains the merged dispatcher | VERIFIED        |
| Desktop Tauri shell               | yes                | Desktop bundles + Windows native E2E passed on PR #47 exact head                                    | VERIFIED        |
| Desktop SQLite/vault/backup       | yes                | Rust/native quality gates passed; dedicated real-instance recovery drill remains                    | PARTIAL         |
| Desktop campaigns/tasks/CRM/inbox | yes                | Main unit/integration coverage passed; full real-instance scenario remains                          | PARTIAL         |
| Web public/PWA                    | yes                | Main CI + live Vercel route/header/404 verification passed                                          | VERIFIED        |
| Mobile Expo control surface       | yes                | PR #47 exact-head Mobile Validation passed                                                          | VERIFIED        |
| Telegram connector                | yes                | Controlled live authorization/delivery evidence remains                                             | UNVERIFIED      |
| Facebook connector                | contract + fixture | No real connector                                                                                   | NOT_IMPLEMENTED |
| Instagram connector               | contract + fixture | No real connector                                                                                   | NOT_IMPLEMENTED |
| WhatsApp connector                | contract + fixture | No real connector                                                                                   | NOT_IMPLEMENTED |
| LinkedIn connector                | yes                | Controlled live authorization/publish evidence remains                                              | UNVERIFIED      |
| TikTok connector                  | contract + fixture | No real connector                                                                                   | NOT_IMPLEMENTED |
| Local Ollama runtime              | yes                | Runtime smoke passed against bounded local AI contract                                              | VERIFIED        |
| Offline licensing                 | yes                | Main tests cover token/constraints; native distribution verification remains                        | PARTIAL         |
| Distribution/signing              | pipeline defined   | Validation artifacts are available; signing remains external                                        | PARTIAL         |
| Accessibility/RTL baseline        | yes                | Automated structural checks exist; dedicated audit remains                                          | PENDING         |
| 24-hour stability soak            | yes                | Workflow/harness exists; no completed 24h evidence yet                                              | UNVERIFIED      |

## Interpretation

A UI option, type, fixture, or pipeline definition is not evidence of a working production integration. Each row changes state only when its corresponding acceptance evidence exists.

The current repository intentionally supports a public/product surface before every external connector is implemented. Release artifacts and public documentation must not imply unsupported platform integrations are production-ready.

The matrix distinguishes source/unit evidence from clean native runtime evidence and controlled live external integration evidence.
