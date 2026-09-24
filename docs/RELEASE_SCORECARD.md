# ORBIT Release Scorecard

Updated: 2026-09-24

Status meanings:
- IMPLEMENTED — source and/or automated checks exist.
- UNVERIFIED — runtime evidence is still missing.
- BLOCKED — an external/infrastructure dependency currently prevents verification.
- PASS — only allowed when fresh execution evidence exists.

## Security

| Gate | Current status | Evidence |
|---|---|---|
| SEC-01 Secrets encrypted at rest | IMPLEMENTED / UNVERIFIED | AES-256-GCM tests, native Argon2id + restore code exist; clean execution pending |
| SEC-02 Secret redaction | IMPLEMENTED / UNVERIFIED | Core redaction tests exist; runtime log scan pending |
| SEC-03 Renderer isolation | IMPLEMENTED / UNVERIFIED | Tauri capability policy exists; E2E pending |
| SEC-04 License tamper detection | IMPLEMENTED / UNVERIFIED | Ed25519 mutation tests exist; clean execution pending |

## Data / Queue

| Gate | Current status | Evidence |
|---|---|---|
| DATA-01 Local SQLite | IMPLEMENTED / UNVERIFIED | Native SQLite runtime exists; clean runtime test pending |
| DATA-02 Migration safety | IMPLEMENTED / UNVERIFIED | v1→v8 migration path + migration tests exist |
| QUE-01 Persistent queue recovery | IMPLEMENTED / UNVERIFIED | Native queue + migration/claim logic exists; restart test pending |
| QUE-02 Bounded retries | IMPLEMENTED / UNVERIFIED | Core + native retry tests exist |
| QUE-03 Circuit breaker | IMPLEMENTED / UNVERIFIED | Core execution policy + runtime controls exist |

## Product workflows

| Gate | Current status | Evidence |
|---|---|---|
| CAMP-01 Campaign → tasks | IMPLEMENTED / UNVERIFIED | Native campaign/task commands + core task factory |
| CAMP-02 Account membership | IMPLEMENTED / UNVERIFIED | Workspace-scoped relational checks and triggers |
| CAMP-03 Approval gates | IMPLEMENTED / UNVERIFIED | Policy + approval persistence + tests |
| INBOX-01 Unified inbox | IMPLEMENTED / UNVERIFIED | Native conversations/messages + core contract |
| CRM-01 Conversation/contact linking | IMPLEMENTED / UNVERIFIED | Native relational checks |
| SYNC-01 Offline persistence | IMPLEMENTED / UNVERIFIED | Yjs primitives exist; multi-device restart test pending |
| SYNC-02 Convergence | IMPLEMENTED / UNVERIFIED | Yjs convergence unit test exists; transport E2E pending |

## Connectors

| Gate | Current status | Evidence |
|---|---|---|
| CONN-01 Capability handshake | IMPLEMENTED / UNVERIFIED | Connector registry/fixture + capability assertions |
| CONN-02 Unsupported action rejection | IMPLEMENTED / UNVERIFIED | Negative tests exist |
| CONN-03 Challenge → human intervention | IMPLEMENTED / UNVERIFIED | Fixture challenge + native Telegram challenge handling; browser E2E pending |
| Telegram native path | IMPLEMENTED / UNVERIFIED | Native API path exists; controlled real-account verification pending |
| Facebook / Instagram / WhatsApp / TikTok | NOT_IMPLEMENTED | No real connector; contract/fixture surfaces only |\n| LinkedIn | IMPLEMENTED / UNVERIFIED | Text publishing Posts API connector exists; controlled authorization/runtime evidence pending |

## Web / Mobile

| Gate | Current status | Evidence |
|---|---|---|
| WEB-01 PWA | IMPLEMENTED / UNVERIFIED | Next static export, manifest, SW, legal/pricing pages |
| MOB-01 Mobile control surface | IMPLEMENTED / UNVERIFIED | Expo config + Node tests exist; device/build evidence pending |
| Web production deployment | BLOCKED | Vercel project exists, but project-level root/framework configuration remains inconsistent with the monorepo |

## Release / Operations

| Gate | Current status | Evidence |
|---|---|---|
| REL-01 Reproducible install | BLOCKED | `pnpm-lock.yaml` and `Cargo.lock` are required release artifacts but are not present; they will not be fabricated without a real dependency resolution environment |
| REL-02 Signed desktop artifact | UNVERIFIED | Release workflow builds unsigned validation artifacts |
| REL-03 Checksum verification | IMPLEMENTED / UNVERIFIED | Release workflow generates and checks SHA-256 manifest |
| OPS-01 Crash/restart recovery | UNVERIFIED | Native recovery logic exists; forced-termination test pending |
| OPS-02 24h soak | UNVERIFIED | No soak evidence yet |
| PERF-01 Startup budget | UNVERIFIED | Measurement pending |
| PERF-02 Memory budget | UNVERIFIED | Measurement pending |
| QA-01 Coverage threshold | UNVERIFIED | Coverage command/config exists; execution pending |
| QA-02 Critical E2E | UNVERIFIED | Test architecture exists; runner unavailable |
| DOC-01 Product docs match | IMPLEMENTED / UNVERIFIED | Architecture/deployment/user/security/release docs updated |
| DOC-02 Security model | IMPLEMENTED / UNVERIFIED | Threat model + security gates present |

## Hard external blockers

### Vercel current deployment evidence

The latest observed Vercel deployment for this branch (`dpl_Fa6zfs1JiTLWGidxjdTaTgH7RZPd`) is in `ERROR` at the install step with `errorCode=ENOENT` and `errorMessage=Command "bash scripts/vercel-install.sh" exited with 1`. The repository-side script fails closed because the committed `pnpm-lock.yaml` is absent. The deployment metadata reports the project framework as `vite`; project-level framework/root settings still require confirmation. No more specific build failure is asserted.


### GitHub Actions

Current hosted jobs fail before the first step:
- steps=[]
- runner_id=0
- empty runner name
- failure within seconds

A minimal diagnostic workflow reproduced the same signature before being removed. Current evidence therefore indicates runner provisioning/startup infrastructure, not a source-level ORBIT build error. GitHub community reports documented the same pre-runner-allocation symptom in September 2026. The GitHub status page currently shows the September 24 incident as resolved, so this repository still needs a fresh successful runner allocation before any CI result can be trusted.

### Vercel

The orbit-marketing-os Vercel project exists. The canonical monorepo configuration is:
- Root Directory: repository root
- Framework: Next.js
- Build command: `pnpm --dir packages/web build`
- Static output: `packages/web/out`

Repository-side vercel.json files are aligned with this configuration. The connected Vercel toolset currently exposes deployment listing but not working project-setting mutation/deploy execution, so the project-level Root Directory remains an external action.

## Release rule

No tag, merge, public launch, or production-ready claim is valid while a required gate is UNVERIFIED or BLOCKED.
