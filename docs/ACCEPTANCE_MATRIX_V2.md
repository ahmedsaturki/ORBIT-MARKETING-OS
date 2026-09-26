# ORBIT Acceptance Matrix v2

Last evidence refresh: 2026-09-26

Status vocabulary: `PASS`, `FAIL`, `PARTIAL`, `UNVERIFIED`, `NOT_APPLICABLE`.

A feature cannot be marked PASS from source inspection alone when the requirement is runtime behavior.

| ID       | Requirement                                                                                                    | Evidence required                                   |
| -------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| SEC-01   | Secrets encrypted at rest                                                                                      | cryptographic tests + restore test                  |
| SEC-02   | Secrets excluded from logs/analytics                                                                           | redaction tests + log scan                          |
| SEC-03   | Renderer capability isolation                                                                                  | Tauri capability review + E2E                       |
| SEC-04   | License tamper detection                                                                                       | mutation/forgery tests                              |
| DATA-01  | Local SQLite persistence                                                                                       | clean runtime test                                  |
| DATA-02  | Migration safety                                                                                               | forward migration + backup restore                  |
| DATA-03  | 1,000 contacts searchable                                                                                      | performance benchmark                               |
| WS-01    | Workspace membership is required for workspace access                                                          | native SQLite membership test + IPC negative test   |
| WS-02    | Workspace switching persists and scopes data                                                                   | restart test + multi-workspace integration test     |
| WS-03    | Workspace membership gates sensitive operations                                                                | negative native IPC tests                           |
| QUE-01   | Persistent queue                                                                                               | restart/recovery test                               |
| QUE-02   | Bounded retries                                                                                                | deterministic retry tests                           |
| QUE-03   | Circuit breaker                                                                                                | fault-injection test                                |
| QUE-04   | Human-intervention wait state                                                                                  | task parks and resumes without consuming an attempt |
| RBAC-01  | Sensitive IPC operations require role authorization                                                            | role matrix test + native IPC integration           |
| CAMP-01  | Campaign creates tasks                                                                                         | integration test                                    |
| CAMP-02  | Account membership enforced                                                                                    | negative integration test                           |
| CAMP-03  | Approval gates block execution                                                                                 | workflow test                                       |
| CONT-01  | Content variants                                                                                               | local AI fixture/provider test                      |
| CONT-02  | Media metadata/search                                                                                          | indexing test                                       |
| CONT-03  | Content validation and platform variant selection                                                              | deterministic content contract tests                |
| MEDIA-01 | Media type/size/hash validation and local search                                                               | media contract tests                                |
| MEDIA-02 | Local media file import with streaming SHA-256                                                                 | native file-hash integration test                   |
| AN-02    | Outcome analytics never aggregate monetary values across currencies                                            | native multi-currency analytics test                |
| AN-01    | Campaign analytics remain campaign-scoped                                                                      | analytics isolation tests                           |
| AUTO-01  | Enabled external automation rules require confirmation                                                         | rule-pack validation tests                          |
| AUTO-02  | Enabled Rule Pack lifecycle is persisted and bounded                                                           | native lifecycle integration test                   |
| UI-01    | Mission Control reflects current workspace operational state without server-side secrets                       | desktop smoke/E2E evidence                          |
| UI-02    | Strategy Studio writes workspace-scoped objectives/audiences/offers/strategies                                 | native IPC + workspace isolation E2E                |
| OUT-01   | Opportunity is workspace-scoped and contact/campaign references stay in-workspace                              | migration + integrity trigger + negative IPC test   |
| OUT-02   | Opportunity value/currency/probability constraints are enforced                                                | validation + SQLite constraint tests                |
| INS-01   | Insight is workspace-scoped and grounded by at least one source                                                | validation + persistence test                       |
| INS-02   | Insight confidence/value constraints are enforced                                                              | validation + SQLite constraint tests                |
| SIM-01   | Governed execution simulation produces a read-only deterministic plan                                          | simulation tests + no-dispatch invariant            |
| REP-01   | Execution replay reconstructs state without re-running external actions                                        | replay validation + deterministic reconstruction    |
| POL-01   | Built-in policy packs materialize explicit workspace-bound safety policies                                     | policy pack tests + workspace identity validation   |
| MC-01    | Mission Control next actions are workspace-scoped, deterministic, explainable, and read-only                   | deterministic ranking tests + workspace validation  |
| PLAN-01  | Campaign plan compiler requires a valid strategy and emits dependency-ordered governed work                    | compiler tests + workspace/strategy validation      |
| AI-02    | Grounded knowledge context excludes untrusted/expired/cross-workspace evidence and obeys budgets               | context tests + workspace/source validation         |
| GRAPH-01 | Operating graph preserves workspace boundaries and rejects invalid links                                       | graph validation tests                              |
| GRAPH-02 | AI/agent graph context is bounded by depth/node/relation scopes                                                | bounded context projection tests                    |
| EXEC-01  | Agent + policy + approval + budget compose into one deterministic execution decision                           | decision kernel tests                               |
| CMD-01   | Command dispatcher enforces registry/surface/scope/approval gates and emits a bounded trace                    | dispatcher tests + event-spine integration          |
| EXP-01   | Experiment definition enforces workspace, variant, allocation, and time-window invariants                      | deterministic core validation tests                 |
| EXP-02   | Variant assignment is deterministic and workspace-scoped                                                       | deterministic assignment tests                      |
| EXP-03   | Experiment summaries ignore cross-workspace observations and compute bounded rates                             | workspace-scoped aggregation tests                  |
| EXP-04   | Learning signals do not claim unsupported statistical significance                                             | learning-signal tests                               |
| EXP-05   | Experiment variants bind only to same-workspace campaign content or unique governed message sources                  | experiment binding tests + campaign contract tests            |
| EXP-06   | Experiment learning produces workspace-scoped descriptive insight/strategy signals without significance claims     | learning write-back tests + outcome integration tests          |
| EVENT-01 | Operational event spine preserves workspace, sequence, parent, trace, redaction, and defensive-copy invariants | event-spine tests + native persistence validation   |
| INBOX-01 | Unified conversation model                                                                                     | connector fixture integration                       |
| CRM-01   | Conversation-contact linking                                                                                   | relational integration test                         |
| SYNC-01  | Offline edits survive restart                                                                                  | device simulation test                              |
| SYNC-02  | Concurrent edits converge                                                                                      | Yjs convergence test                                |
| BACK-01  | Encrypted backup                                                                                               | backup/restore test                                 |
| BACK-02  | Corrupt backup rejected                                                                                        | integrity test                                      |
| BACK-03  | Restore rejects newer/incompatible schema                                                                      | restore integration test                            |
| CONN-01  | Capability handshake                                                                                           | connector contract test                             |
| CONN-02  | Unsupported action rejected                                                                                    | negative connector test                             |
| CONN-03  | Challenge causes safe stop                                                                                     | browser fixture test                                |
| CONN-04  | Native direct execution enforces local daily/circuit safety budgets                                            | Rust unit test + source gate                        |
| CONN-05  | LinkedIn Posts API connector is capability/authorization scoped                                                | connector unit fixtures + controlled API test       |
| WEB-01   | PWA manifest/service worker                                                                                    | production browser test                             |
| AI-01    | Local AI Studio chat/content/image analysis stays on local runtime boundary                                    | desktop client contract tests + runtime smoke       |
| MOB-01   | Mobile control surface                                                                                         | Expo typecheck/build test                           |
| REL-01   | Reproducible workspace install                                                                                 | clean CI checkout                                   |
| REL-02   | Signed desktop artifact                                                                                        | release pipeline evidence                           |
| REL-03   | Checksums match distributed artifacts                                                                          | release verification                                |
| LIC-01   | Offline license install/verification/removal                                                                   | signed token tests + native integration             |
| OPS-01   | Crash recovery                                                                                                 | forced termination test                             |
| OPS-02   | 24h stability                                                                                                  | soak-test evidence                                  |
| PERF-01  | Startup target                                                                                                 | measured benchmark                                  |
| PERF-02  | Memory target                                                                                                  | measured benchmark                                  |
| QA-01    | Unit coverage threshold                                                                                        | coverage report                                     |
| QA-02    | Critical E2E paths                                                                                             | Playwright report                                   |
| DOC-01   | User guide matches product                                                                                     | documentation review                                |
| DOC-02   | Security model documented                                                                                      | security review                                     |

## Gate rules

- Any `FAIL` in SEC, DATA, QUE, CAMP, CONN, REL, SIM, REP, POL, CMD or EVENT blocks release.
- Any `UNVERIFIED` runtime requirement blocks the claim "production ready".
- Performance targets are measured, never inferred from code size.
- Real-platform tests must be controlled and must not be used to claim immunity from platform enforcement.
