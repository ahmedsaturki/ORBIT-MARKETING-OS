# ORBIT Release Scorecard

Updated: 2026-09-25

Status meanings:

- IMPLEMENTED — source and/or automated checks exist.
- UNVERIFIED — runtime evidence is still missing.
- BLOCKED — an external/infrastructure dependency currently prevents verification.
- PASS — only allowed when fresh execution evidence exists.

## Security

| Gate                             | Current status | Evidence                                                       |
| -------------------------------- | -------------- | -------------------------------------------------------------- |
| SEC-01 Secrets encrypted at rest | VERIFIED       | Native encryption plus current main security/Rust gates passed |
| SEC-02 Secret redaction          | VERIFIED       | Secret scan and core tests passed in main CI                   |
| SEC-03 Renderer isolation        | VERIFIED       | Tauri capability policy and E2E/quality gates passed           |
| SEC-04 License tamper detection  | VERIFIED       | License tests passed in main CI                                |

## Data / Queue

| Gate                             | Current status           | Evidence                                                                    |
| -------------------------------- | ------------------------ | --------------------------------------------------------------------------- |
| DATA-01 Local SQLite             | VERIFIED                 | Native runtime implementation and current Rust quality gates passed         |
| DATA-02 Migration safety         | VERIFIED                 | Versioned migration chain through v10 is covered by current main validation |
| QUE-01 Persistent queue recovery | IMPLEMENTED / UNVERIFIED | Native queue + migration/claim logic exists; restart test pending           |
| QUE-02 Bounded retries           | VERIFIED                 | Core and native retry validation passed                                     |
| QUE-03 Circuit breaker           | VERIFIED                 | Policy/runtime controls covered by current tests                            |

## Product workflows

| Gate                                | Current status | Evidence                                                                                                          |
| ----------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------- |
| CAMP-01 Campaign → tasks            | VERIFIED       | Native commands and core tests passed                                                                             |
| CAMP-02 Account membership          | VERIFIED       | Workspace checks/triggers validated by main gates                                                                 |
| CAMP-03 Approval gates              | VERIFIED       | Approval policy/persistence tests passed                                                                          |
| INBOX-01 Unified inbox              | VERIFIED       | Native inbox model and current main tests passed                                                                  |
| CRM-01 Conversation/contact linking | VERIFIED       | Native relational checks passed                                                                                   |
| SYNC-01 Offline persistence         | VERIFIED       | Encrypted reconnect/convergence simulation merged and verified                                                    |
| SYNC-02 Convergence                 | VERIFIED*      | Encrypted disconnect/reconnect convergence simulation passed; live multi-device network remains separate evidence |

## Connectors

| Gate                                     | Current status           | Evidence                                                                                      |
| ---------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------- |
| CONN-01 Capability handshake             | VERIFIED                 | Connector registry/fixture/capability tests passed                                            |
| CONN-02 Unsupported action rejection     | VERIFIED                 | Negative connector tests passed                                                               |
| CONN-03 Challenge → human intervention   | VERIFIED                 | Challenge handling and human-intervention stop paths are covered                              |
| Telegram native path                     | IMPLEMENTED / UNVERIFIED | Native API path exists; controlled real-account verification pending                          |
| Facebook / Instagram / WhatsApp / TikTok | NOT_IMPLEMENTED          | No real connector; contract/fixture surfaces only                                             |
| LinkedIn                                 | IMPLEMENTED / UNVERIFIED | Text publishing Posts API connector exists; controlled authorization/runtime evidence pending |

## Web / Mobile

| Gate                          | Current status | Evidence                                                                                                                               |
| ----------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| WEB-01 PWA                    | VERIFIED       | Main web build/E2E and live production checks                                                                                          |
| MOB-01 Mobile control surface | VERIFIED*      | Main mobile checks and Android debug validation path pass; store release remains separate                                              |
| Web production deployment     | VERIFIED*      | READY Vercel production deployment and live verification are recorded; effective project framework metadata still needs reconciliation |

## Release / Operations

| Gate                           | Current status           | Evidence                                                                    |
| ------------------------------ | ------------------------ | --------------------------------------------------------------------------- |
| REL-01 Reproducible install    | VERIFIED                 | Committed pnpm-lock.yaml and desktop Cargo.lock; main frozen install passed |
| REL-02 Signed desktop artifact | UNVERIFIED               | Release workflow builds unsigned validation artifacts                       |
| REL-03 Checksum verification   | IMPLEMENTED / UNVERIFIED | Release workflow generates and checks SHA-256 manifest                      |
| OPS-01 Crash/restart recovery  | UNVERIFIED               | Native recovery logic exists; forced-termination test pending               |
| OPS-02 24h soak                | UNVERIFIED               | No soak evidence yet                                                        |
| PERF-01 Startup budget         | UNVERIFIED               | Measurement pending                                                         |
| PERF-02 Memory budget          | UNVERIFIED               | Measurement pending                                                         |
| QA-01 Coverage threshold       | VERIFIED                 | Main CI coverage gate passed                                                |
| QA-02 Critical E2E             | VERIFIED*                | Main browser E2E passed; native Windows E2E remains tied to PR #27          |
| DOC-01 Product docs match      | IMPLEMENTED / UNVERIFIED | Architecture/deployment/user/security/release docs updated                  |
| DOC-02 Security model          | IMPLEMENTED / UNVERIFIED | Threat model + security gates present                                       |

## Hard external blockers

### Vercel current deployment evidence

Older Vercel ERROR deployments are historical evidence only. Current Vercel state has a READY production deployment and the live web surface has been verified. The effective project metadata still reports framework `vite` while the repository contract targets a Next.js static export; this remains a settings-reconciliation item, not evidence of a current build failure.

### GitHub Actions

Historical hosted runner failures on the earlier rebuild line failed before the first step. The current main line now has real hosted executions with successful quality/Rust/Web gates.

- steps=[]
- runner_id=0
- empty runner name
- failure within seconds

A minimal diagnostic workflow reproduced the same signature before being removed. Current evidence therefore indicates runner provisioning/startup infrastructure, not a source-level ORBIT build error. The repository reproduced the same pre-step failure on both the rebuild line and main. The current main line already has trusted successful hosted-run evidence; self-hosted execution remains only a zero-cost fallback for native/manual gates.

### Vercel

The orbit-marketing-os Vercel project exists. The canonical monorepo configuration is:

- Root Directory: repository root
- Framework: Next.js
- Build command: `pnpm --dir packages/web build`
- Static output: `packages/web/out`

Repository-side vercel.json files are aligned with this configuration. The connected Vercel toolset currently exposes deployment listing but not working project-setting mutation/deploy execution. Repository configuration now disables automatic Git deployments, so production deployment is intentionally reserved for the guarded prebuilt workflow.

## Release rule

No tag, merge, public launch, or production-ready claim is valid while a required gate is UNVERIFIED or BLOCKED.
