# ORBIT Acceptance Matrix v2

Status vocabulary: `PASS`, `FAIL`, `PARTIAL`, `UNVERIFIED`, `NOT_APPLICABLE`.

A feature cannot be marked PASS from source inspection alone when the requirement is runtime behavior.

| ID | Requirement | Evidence required |
|---|---|---|
| SEC-01 | Secrets encrypted at rest | cryptographic tests + restore test |
| SEC-02 | Secrets excluded from logs/analytics | redaction tests + log scan |
| SEC-03 | Renderer capability isolation | Tauri capability review + E2E |
| SEC-04 | License tamper detection | mutation/forgery tests |
| DATA-01 | Local SQLite persistence | clean runtime test |
| DATA-02 | Migration safety | forward migration + backup restore |
| DATA-03 | 1,000 contacts searchable | performance benchmark |
| WS-01 | Workspace membership is required for workspace access | native SQLite membership test + IPC negative test |
| WS-02 | Workspace switching persists and scopes data | restart test + multi-workspace integration test |
| WS-03 | Workspace membership gates sensitive operations | negative native IPC tests |
| QUE-01 | Persistent queue | restart/recovery test |
| QUE-02 | Bounded retries | deterministic retry tests |
| QUE-03 | Circuit breaker | fault-injection test |
| QUE-04 | Human-intervention wait state | task parks and resumes without consuming an attempt |
| RBAC-01 | Sensitive IPC operations require role authorization | role matrix test + native IPC integration |
| CAMP-01 | Campaign creates tasks | integration test |
| CAMP-02 | Account membership enforced | negative integration test |
| CAMP-03 | Approval gates block execution | workflow test |
| CONT-01 | Content variants | local AI fixture/provider test |
| CONT-02 | Media metadata/search | indexing test |
| CONT-03 | Content validation and platform variant selection | deterministic content contract tests |
| MEDIA-01 | Media type/size/hash validation and local search | media contract tests |
| MEDIA-02 | Local media file import with streaming SHA-256 | native file-hash integration test |
| AN-01 | Campaign analytics remain campaign-scoped | analytics isolation tests |
| AUTO-01 | Enabled external automation rules require confirmation | rule-pack validation tests |
| AUTO-02 | Enabled Rule Pack lifecycle is persisted and bounded | native lifecycle integration test |
| INBOX-01 | Unified conversation model | connector fixture integration |
| CRM-01 | Conversation-contact linking | relational integration test |
| SYNC-01 | Offline edits survive restart | device simulation test |
| SYNC-02 | Concurrent edits converge | Yjs convergence test |
| BACK-01 | Encrypted backup | backup/restore test |
| BACK-02 | Corrupt backup rejected | integrity test |
| BACK-03 | Restore rejects newer/incompatible schema | restore integration test |
| CONN-01 | Capability handshake | connector contract test |
| CONN-02 | Unsupported action rejected | negative connector test |
| CONN-03 | Challenge causes safe stop | browser fixture test |
| CONN-04 | Native direct execution enforces local daily/circuit safety budgets | Rust unit test + source gate |
| WEB-01 | PWA manifest/service worker | production browser test |
| MOB-01 | Mobile control surface | Expo typecheck/build test |
| REL-01 | Reproducible workspace install | clean CI checkout |
| REL-02 | Signed desktop artifact | release pipeline evidence |
| REL-03 | Checksums match distributed artifacts | release verification |
| LIC-01 | Offline license install/verification/removal | signed token tests + native integration |
| OPS-01 | Crash recovery | forced termination test |
| OPS-02 | 24h stability | soak-test evidence |
| PERF-01 | Startup target | measured benchmark |
| PERF-02 | Memory target | measured benchmark |
| QA-01 | Unit coverage threshold | coverage report |
| QA-02 | Critical E2E paths | Playwright report |
| DOC-01 | User guide matches product | documentation review |
| DOC-02 | Security model documented | security review |

## Gate rules

- Any `FAIL` in SEC, DATA, QUE, CAMP, CONN or REL blocks release.
- Any `UNVERIFIED` runtime requirement blocks the claim "production ready".
- Performance targets are measured, never inferred from code size.
- Real-platform tests must be controlled and must not be used to claim immunity from platform enforcement.
