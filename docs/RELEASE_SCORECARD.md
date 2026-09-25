# ORBIT Release Scorecard

Updated: 2026-09-26

Status meanings:

- IMPLEMENTED — source and/or automated checks exist.
- UNVERIFIED — runtime evidence is still missing.
- BLOCKED — an external/infrastructure dependency currently prevents verification.
- PASS — only allowed when fresh execution evidence exists.

## Security

| Gate                             | Current status | Evidence                                                 |
| -------------------------------- | -------------- | -------------------------------------------------------- |
| SEC-01 Secrets encrypted at rest | VERIFIED       | Native encryption plus hosted security/Rust gates passed |
| SEC-02 Secret redaction          | VERIFIED       | Secret scan and core tests passed                        |
| SEC-03 Renderer isolation        | VERIFIED       | Tauri capability policy and E2E/quality gates passed     |
| SEC-04 License tamper detection  | VERIFIED       | License tests passed                                     |

## Data / Queue

| Gate                             | Current status           | Evidence                                                                       |
| -------------------------------- | ------------------------ | ------------------------------------------------------------------------------ |
| DATA-01 Local SQLite             | VERIFIED                 | Native implementation and current Rust/native quality gates passed             |
| DATA-02 Migration safety         | VERIFIED                 | Versioned migration chain through v13 plus transactional migration tests       |
| QUE-01 Persistent queue recovery | IMPLEMENTED / UNVERIFIED | Native queue/recovery logic exists; dedicated forced-termination drill remains |
| QUE-02 Bounded retries           | VERIFIED                 | Core/native retry validation passed                                            |
| QUE-03 Circuit breaker           | VERIFIED                 | Policy/runtime controls covered by current tests                               |

## Product workflows

| Gate                                | Current status | Evidence                                                                    |
| ----------------------------------- | -------------- | --------------------------------------------------------------------------- |
| CAMP-01 Campaign → tasks            | VERIFIED       | Native commands and core tests passed                                       |
| CAMP-02 Account membership          | VERIFIED       | Workspace checks/triggers validated                                         |
| CAMP-03 Approval gates              | VERIFIED       | Approval policy/persistence tests passed                                    |
| INBOX-01 Unified inbox              | VERIFIED       | Native inbox model/tests passed                                             |
| CRM-01 Conversation/contact linking | VERIFIED       | Native relational checks passed                                             |
| SYNC-01 Offline persistence         | VERIFIED       | Encrypted reconnect/convergence tests passed                                |
| SYNC-02 Convergence                 | VERIFIED*      | Simulation/test evidence passed; live multi-device network remains separate |
| CMD-01 Command dispatcher           | PENDING        | Dispatcher implementation is on current validation branch                   |
| EVENT-01 Operational event spine    | VERIFIED       | PR #47 exact-head tests/native validation passed                            |

## Connectors

| Gate                                     | Current status           | Evidence                                                                                      |
| ---------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------- |
| CONN-01 Capability handshake             | VERIFIED                 | Connector registry/fixture/capability tests passed                                            |
| CONN-02 Unsupported action rejection     | VERIFIED                 | Negative connector tests passed                                                               |
| CONN-03 Challenge → human intervention   | VERIFIED                 | Challenge handling and human-intervention stop paths are covered                              |
| Telegram native path                     | IMPLEMENTED / UNVERIFIED | Native API path exists; controlled real-account verification pending                          |
| LinkedIn                                 | IMPLEMENTED / UNVERIFIED | Text publishing Posts API connector exists; controlled authorization/runtime evidence pending |
| Facebook / Instagram / WhatsApp / TikTok | NOT_IMPLEMENTED          | Contract/fixture surfaces only                                                                |

## Web / Mobile

| Gate                          | Current status | Evidence                                                                       |
| ----------------------------- | -------------- | ------------------------------------------------------------------------------ |
| WEB-01 PWA                    | VERIFIED       | Main web build/E2E and live production checks                                  |
| MOB-01 Mobile control surface | VERIFIED       | PR #47 exact-head Mobile Validation passed                                     |
| Native desktop packaging      | VERIFIED       | PR #47 exact-head Desktop Native Validation passed                             |
| Web production deployment     | VERIFIED*      | READY Vercel production deployment; provenance/settings reconciliation remains |

## Release / Operations

| Gate                           | Current status           | Evidence                                                                                 |
| ------------------------------ | ------------------------ | ---------------------------------------------------------------------------------------- |
| REL-01 Reproducible install    | VERIFIED                 | Committed pnpm-lock.yaml and desktop Cargo.lock; hosted frozen install passed            |
| REL-02 Signed desktop artifact | UNVERIFIED               | Artifacts are unsigned until signing identities are configured                           |
| REL-03 Checksum verification   | IMPLEMENTED / UNVERIFIED | SHA-256 release verification is implemented; fresh distributed artifact evidence remains |
| LIC-01 Offline license         | PARTIAL                  | Token/constraint tests pass; distribution verification remains                           |
| OPS-01 Crash/restart recovery  | UNVERIFIED               | Forced-termination acceptance drill pending                                              |
| OPS-02 24h soak                | UNVERIFIED               | No completed 24-hour evidence                                                            |
| PERF-01 Startup budget         | UNVERIFIED               | Measurement pending                                                                      |
| PERF-02 Memory budget          | UNVERIFIED               | Measurement pending                                                                      |
| QA-01 Coverage threshold       | VERIFIED                 | Hosted coverage gate passed                                                              |
| QA-02 Critical E2E             | VERIFIED*                | Main browser E2E plus exact-head native E2E passed                                       |
| DOC-01 Product docs match      | PENDING                  | Release docs are being reconciled to the post-PR47 current line                          |
| DOC-02 Security model          | IMPLEMENTED / UNVERIFIED | Threat model/security gates exist; dedicated security review remains                     |

## External / commercial prerequisites

- Vercel production is live, but effective project metadata still reports `framework: vite` while the repository contract expects Next.js static export; latest READY deployment has empty Git metadata.
- A fresh Vercel guarded/provenance deployment and rollback drill remain to be evidenced.
- Desktop signing/notarization requires external signing identities.
- Mobile production signing/store publication requires external store credentials/configuration.
- Commercial billing/payment is not configured.
- Main branch protection/ruleset state remains unverified.

## Release rule

No tag, public commercial launch, or production-ready claim is valid while a required gate is UNVERIFIED or BLOCKED.
