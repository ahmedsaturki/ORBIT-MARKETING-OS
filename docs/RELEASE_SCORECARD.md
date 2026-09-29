# ORBIT Release Scorecard

Updated: 2026-09-29.

## Status meanings

- IMPLEMENTED — source and/or automated checks exist.
- UNVERIFIED — required runtime evidence is still missing.
- PARTIAL — evidence covers only part of the gate.
- BLOCKED — an external prerequisite currently prevents completion.
- VERIFIED — fresh execution evidence exists.

## Security

| Gate                             | Status   | Evidence                                                 |
| -------------------------------- | -------- | -------------------------------------------------------- |
| SEC-01 Secrets encrypted at rest | VERIFIED | Native encryption plus hosted security/Rust gates passed |
| SEC-02 Secret redaction          | VERIFIED | Secret scan and core tests passed                        |
| SEC-03 Renderer isolation        | VERIFIED | Tauri capability policy and native E2E passed            |
| SEC-04 License tamper detection  | VERIFIED | License tests passed                                     |

## Data / Queue

| Gate                             | Status   | Evidence                                                                                                    |
| -------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------- |
| DATA-01 Local SQLite             | VERIFIED | Native implementation and validated Rust/native gates                                                       |
| DATA-02 Migration safety         | VERIFIED | Versioned migrations through v16 and migration tests                                                        |
| DATA-03 Search scale             | VERIFIED | CI 36480198008 on current main; 1,000-contact search measured 1.147968ms                                    |
| QUE-01 Persistent queue recovery | VERIFIED | CI 36480198008 on current main; recovery artifact `10995738209` proves 4/4 recovery/idempotency checks PASS |
| QUE-02 Bounded retries           | VERIFIED | Core/native retry validation passed                                                                         |
| QUE-03 Circuit breaker           | VERIFIED | Policy/runtime controls covered                                                                             |
| QUE-04 Human-intervention wait   | VERIFIED | Explicit wait/resume contract and tests                                                                     |

## Product workflows

| Gate                                | Status   | Evidence                                                        |
| ----------------------------------- | -------- | --------------------------------------------------------------- |
| CAMP-01 Campaign → tasks            | VERIFIED | Native commands and core tests                                  |
| CAMP-02 Account membership          | VERIFIED | Workspace checks/triggers                                       |
| CAMP-03 Approval gates              | VERIFIED | Approval policy/persistence tests                               |
| INBOX-01 Unified inbox              | VERIFIED | Native inbox model/tests                                        |
| CRM-01 Conversation/contact linking | VERIFIED | Native relational checks                                        |
| SYNC-01 Offline persistence         | VERIFIED | Encrypted reconnect/convergence tests                           |
| SYNC-02 Convergence                 | PARTIAL  | Automated convergence passed; live multi-device network remains |
| CMD-01 Command dispatcher           | VERIFIED | Exact-head validation passed before merge                       |
| EVENT-01 Operational event spine    | VERIFIED | Exact-head validation passed before merge                       |
| SEARCH-01 Universal Search          | VERIFIED | Exact-head Windows Native E2E passed after escaping fix         |
| PUB-01 Publishing Calendar          | VERIFIED | PR #72 exact-head native validation passed                      |
| PUB-02 Bulk Planner                 | VERIFIED | Bounded planner + approval behavior validated                   |

## Intelligence

| Gate                                     | Status      | Evidence                                                          |
| ---------------------------------------- | ----------- | ----------------------------------------------------------------- |
| RESEARCH-01 Research evidence model      | VERIFIED    | Native persistence, workspace checks and source/evidence contract |
| EXP-01 Deterministic experimentation     | VERIFIED    | Deterministic assignment and aggregation tests                    |
| EXP-02 Descriptive uncertainty           | VERIFIED    | Wilson/Newcombe-Wilson bounded interval implementation/tests      |
| AN-01 Descriptive anomaly detection      | VERIFIED    | Deterministic rolling median/MAD tests                            |
| AGENT-01 Governed agent registry         | VERIFIED    | Agent authorization and workspace boundaries                      |
| PLATFORM-01 Platform manifest foundation | IMPLEMENTED | Unit-tested registry foundation; deeper integration remains       |

## Connectors

| Gate                                     | Status          | Evidence                                    |
| ---------------------------------------- | --------------- | ------------------------------------------- |
| CONN-01 Capability handshake             | VERIFIED        | Connector registry/fixture/capability tests |
| CONN-02 Unsupported action rejection     | VERIFIED        | Negative connector tests                    |
| CONN-03 Challenge → human intervention   | VERIFIED        | Challenge handling and stop paths           |
| Telegram native path                     | UNVERIFIED      | Real-account proof pending                  |
| LinkedIn                                 | UNVERIFIED      | Real-account proof pending                  |
| Facebook / Instagram / WhatsApp / TikTok | NOT_IMPLEMENTED | Contract/fixture surfaces only              |

## Web / Mobile

| Gate                          | Status     | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WEB-01 PWA                    | VERIFIED   | Web build/E2E and live checks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| MOB-01 Mobile control surface | VERIFIED   | Mobile validation passed on validated release line                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Native desktop packaging      | VERIFIED   | Windows/Linux/macOS x64/ARM validation passed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Web production availability   | VERIFIED   | Current READY deployment responds successfully                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Web production provenance     | UNVERIFIED | Production serves commit `9ba07318f4d580e670be9d27ec76888e66013340`, and the public `/api/release` `unreleased` drift present before the shared `release-identity.ts` module landed in `88d54d20` is now FIXED: `/api/health`, `/api/health.json`, `/api/release` and `/api/release.json` all report version `1.0.0` and that SHA with provenance source `VERCEL_GIT_COMMIT_SHA`, and `scripts/verify-public-vercel-provenance.mjs` returned `status: PASS` on attempt 1 against `/`, `/api/health.json` and `/api/release.json` including the home page `data-release-sha` attribute. This gate stays UNVERIFIED because a production-proven claim still requires the open rollback drill plus the other open release-critical gates; prior verified deployment `dpl_3YiUkYHNpQPRaPjTZvH5UrTztEQp` confirmed for release lineage continuity |

## Release / Operations

| Gate                           | Status     | Evidence                                                                                                                       |
| ------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| REL-01 Reproducible install    | VERIFIED   | Committed pnpm-lock.yaml/Cargo.lock + frozen install                                                                           |
| REL-02 Signed desktop artifact | BLOCKED    | Signing identities not configured                                                                                              |
| REL-03 Checksum verification   | PARTIAL    | Validation pipeline generates and checks checksums; final distributed release evidence remains                                 |
| LIC-01 Offline license         | PARTIAL    | Token/constraint tests pass; production distribution proof remains                                                             |
| OPS-01 Crash/restart recovery  | VERIFIED   | CI 36480198008 + recovery artifact `10995738209`; 4/4 startup/database/idempotency/migration checks PASS                       |
| OPS-02 24h soak                | UNVERIFIED | No completed 24-hour evidence                                                                                                  |
| PERF-01 Startup budget         | VERIFIED   | CI 36480198008 on current main; startup-to-health 378.15ms; enforced budget ≤8000ms                                            |
| PERF-02 Memory budget          | VERIFIED   | CI 36480198008 on current main; peak RSS 96.65MB; enforced budgets 200MB RSS / 100MB heap                                      |
| QA-01 Coverage threshold       | VERIFIED   | Hosted coverage gate passed                                                                                                    |
| QA-02 Critical E2E             | VERIFIED   | Current validated feature line passed required E2E/native gates                                                                |
| DOC-01 Product docs            | VERIFIED   | `release/readiness.json` and the release/launch scorecards reconciled to observed production and GitHub evidence on 2026-09-29 |
| DOC-02 Security model          | PARTIAL    | Threat model/security gates exist; final review remains                                                                        |

## External / commercial prerequisites

- Vercel production infrastructure is live and currently has no grouped runtime errors in the selected seven-day window.
- `release/PRODUCTION_RELEASE.json` declares `orbit-v1.0.0-prod` (`version 1.0.0`, `status: PRODUCTION_READY`, `gitCommit f65c153`) and its own notes state that release-critical gates remain open and production provenance is UNVERIFIED. The marker pins `f65c153` **by design**: `scripts/vercel-ignore.sh` triggers a Vercel build when a commit _changes_ the marker file, not when `marker.gitCommit` equals HEAD, so the marker is a pinned historical release identifier and is not expected to track the moving main HEAD. It must not be "fixed" to match HEAD; that SHA-chasing loop was already stopped.
- The observed live production release identity is separate from that pinned marker: production serves `9ba07318f4d580e670be9d27ec76888e66013340` and reports it through the shared release-identity endpoints. Vercel Production Provenance run `36609486608`, Web Deploy run `36609486630` and ORBIT Release Evidence Bundle run `36609486555` all passed on that commit, as did CI run `36609486448` (jobs `ci`, `security:scan`, `Rust quality`). The rollback drill remains separate and open; overall release state is UNVERIFIED, not production-proven.
- The latest main SonarCloud analysis remains failed on `B Security Rating on New Code` (required `A`); this predates the current documentation-only reconciliation and has not been masked as a pass.
- Desktop signing/notarization needs external signing identities.
- Mobile production signing/store publication needs external store credentials.
- Commercial billing/payment is not configured.
- CI run `36609486448` on `9ba07318` completed successfully with jobs `ci`, `security:scan` and `Rust quality`; the recovery/performance measurements from the prior cycle remain preserved in recovery artifact `10995738209` and its CI log.
- GitHub `main` is protected with required `ci` and `security:scan`; final L3 governance evidence still requires auditable evidence references and verification time.

## Release rule

No tag, public commercial launch, or production-ready claim is valid while a required gate is UNVERIFIED or BLOCKED.
