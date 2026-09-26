# ORBIT Release Scorecard

Updated: 2026-09-26.

## Status meanings

- IMPLEMENTED — source and/or automated checks exist.
- UNVERIFIED — required runtime evidence is still missing.
- PARTIAL — evidence covers only part of the gate.
- BLOCKED — an external prerequisite currently prevents completion.
- VERIFIED — fresh execution evidence exists.

## Security

| Gate | Status | Evidence |
| --- | --- | --- |
| SEC-01 Secrets encrypted at rest | VERIFIED | Native encryption plus hosted security/Rust gates passed |
| SEC-02 Secret redaction | VERIFIED | Secret scan and core tests passed |
| SEC-03 Renderer isolation | VERIFIED | Tauri capability policy and E2E/quality gates passed |
| SEC-04 License tamper detection | VERIFIED | License tests passed |

## Data / Queue

| Gate | Status | Evidence |
| --- | --- | --- |
| DATA-01 Local SQLite | VERIFIED | Native implementation and validated Rust/native gates |
| DATA-02 Migration safety | VERIFIED | Versioned migration chain through v15 and migration tests |
| DATA-03 Search scale | UNVERIFIED | Search contract exists; the 1,000-contact benchmark still needs fresh measured evidence |
| QUE-01 Persistent queue recovery | PARTIAL | Native recovery logic/tests exist; release evidence consolidation remains |
| QUE-02 Bounded retries | VERIFIED | Core/native retry validation passed |
| QUE-03 Circuit breaker | VERIFIED | Policy/runtime controls are covered by tests |
| QUE-04 Human-intervention wait | VERIFIED | Explicit wait/resume contract and tests |

## Product workflows

| Gate | Status | Evidence |
| --- | --- | --- |
| CAMP-01 Campaign → tasks | VERIFIED | Native commands and core tests |
| CAMP-02 Account membership | VERIFIED | Workspace checks/triggers |
| CAMP-03 Approval gates | VERIFIED | Approval policy/persistence tests |
| INBOX-01 Unified inbox | VERIFIED | Native inbox model/tests |
| CRM-01 Conversation/contact linking | VERIFIED | Native relational checks |
| SYNC-01 Offline persistence | VERIFIED | Encrypted reconnect/convergence tests |
| SYNC-02 Convergence | VERIFIED* | Automated convergence evidence; live multi-device network remains separate |
| CMD-01 Command dispatcher | VERIFIED | Exact-head validation passed before merge |
| EVENT-01 Operational event spine | VERIFIED | Exact-head validation passed before merge |
| SEARCH-01 Universal Search | VERIFIED* | Native E2E covers workspace isolation and multi-entity search; current exact-head release line is still gated |

## Intelligence

| Gate | Status | Evidence |
| --- | --- | --- |
| RESEARCH-01 Research evidence model | VERIFIED | Native persistence, workspace checks and source/evidence contract |
| EXP-01 Deterministic experimentation | VERIFIED | Deterministic assignment and aggregation tests |
| EXP-02 Descriptive uncertainty | VERIFIED | Wilson/Newcombe-Wilson bounded interval implementation/tests |
| AN-01 Descriptive anomaly detection | VERIFIED | Deterministic rolling median/MAD tests |
| AGENT-01 Governed agent registry | VERIFIED | Agent definition/authorization tests and native workspace boundaries |
| PLATFORM-01 Platform manifest foundation | IMPLEMENTED | New manifest/registry foundation is unit-tested; exact-head integration evidence remains |

## Connectors

| Gate | Status | Evidence |
| --- | --- | --- |
| CONN-01 Capability handshake | VERIFIED | Connector registry/fixture/capability tests |
| CONN-02 Unsupported action rejection | VERIFIED | Negative connector tests |
| CONN-03 Challenge → human intervention | VERIFIED | Challenge handling and human-intervention stop paths |
| Telegram native path | UNVERIFIED | Native API path exists; real-account proof pending |
| LinkedIn | UNVERIFIED | Text publishing Posts API path exists; real-account proof pending |
| Facebook / Instagram / WhatsApp / TikTok | NOT_IMPLEMENTED | Contract/fixture surfaces only |

## Web / Mobile

| Gate | Status | Evidence |
| --- | --- | --- |
| WEB-01 PWA | VERIFIED | Web build/E2E and live checks |
| MOB-01 Mobile control surface | VERIFIED | Mobile validation passed on validated release line |
| Native desktop packaging | VERIFIED | Native packaging validation passed on validated release lines |
| Web production deployment | VERIFIED* | READY Vercel deployment; provenance/settings reconciliation remains |

## Release / Operations

| Gate | Status | Evidence |
| --- | --- | --- |
| REL-01 Reproducible install | VERIFIED | Committed pnpm-lock.yaml/Cargo.lock + frozen install |
| REL-02 Signed desktop artifact | BLOCKED | Signing identities not configured |
| REL-03 Checksum verification | PARTIAL | Verification implementation exists; fresh distributed release evidence remains |
| LIC-01 Offline license | PARTIAL | Token/constraint tests pass; distribution proof remains |
| OPS-01 Crash/restart recovery | PARTIAL | Native tests plus restart/queue recovery E2E exist; final consolidated release evidence remains |
| OPS-02 24h soak | UNVERIFIED | No completed 24h evidence |
| PERF-01 Startup budget | UNVERIFIED | Fresh measured benchmark pending |
| PERF-02 Memory budget | UNVERIFIED | Fresh measured benchmark pending |
| QA-01 Coverage threshold | VERIFIED | Hosted coverage gate passed |
| QA-02 Critical E2E | VERIFIED* | Browser/native E2E evidence exists; current exact release line still gated |
| DOC-01 Product docs | PARTIAL | This reconciliation updates product/release truth; final post-merge head metadata remains |
| DOC-02 Security model | IMPLEMENTED / UNVERIFIED | Threat model and security gates exist; dedicated final review remains |

## External / commercial prerequisites

- Vercel production is live and currently has no grouped runtime errors in the selected seven-day window.
- Project metadata/provenance still needs guarded reconciliation so framework/root-directory expectations are explicit and repository provenance is consistently present.
- Desktop signing/notarization needs external signing identities.
- Mobile production signing/store publication needs external store credentials/configuration.
- Commercial billing/payment is not configured.
- Main branch protection/ruleset state remains unverified.

## Release rule

No tag, public commercial launch, or production-ready claim is valid while a required gate is UNVERIFIED or BLOCKED.