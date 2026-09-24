# ORBIT Acceptance Matrix v2

Status vocabulary: `PASS`, `FAIL`, `PARTIAL`, `UNVERIFIED`, `NOT_APPLICABLE`.

A feature cannot be marked PASS from source inspection alone when the requirement is runtime behavior.

| ID | Requirement | Evidence required | Status | Evidence |
|---|---|---|---|---|
| SEC-01 | Secrets encrypted at rest | cryptographic tests + restore test | UNVERIFIED | Vault runtime not yet wired |
| SEC-02 | Secrets excluded from logs/analytics | redaction tests + log scan | UNVERIFIED | Redaction tests pending |
| SEC-03 | Renderer capability isolation | Tauri capability review + E2E | UNVERIFIED | Tauri shell not configured |
| SEC-04 | License tamper detection | mutation/forgery tests | UNVERIFIED | License validator tests pending |
| DATA-01 | Local SQLite persistence | clean runtime test | UNVERIFIED | SQLite layer not yet implemented |
| DATA-02 | Migration safety | forward migration + backup restore | UNVERIFIED | Migrations pending |
| DATA-03 | 1,000 contacts searchable | performance benchmark | UNVERIFIED | Benchmark pending |
| QUE-01 | Persistent queue | restart/recovery test | PARTIAL | Queue state machine implemented (`packages/core/src/queue`); persistence/restart not yet runtime-tested |
| QUE-02 | Bounded retries | deterministic retry tests | PASS | `packages/core/test/queue.test.ts` (shouldRetry, scheduleRetry, backoff bounds) |
| QUE-03 | Circuit breaker | fault-injection test | PASS | `packages/core/test/policy.test.ts` (failure injection opens breaker; half-open after pause) |
| CAMP-01 | Campaign creates tasks | integration test | UNVERIFIED | Campaign→task integration pending |
| CAMP-02 | Account membership enforced | negative integration test | UNVERIFIED | Membership checks pending |
| CAMP-03 | Approval gates block execution | workflow test | PASS | `packages/core/test/approval.test.ts` (fail-closed without approval evidence) + queue gate blocks when `approvalAllowed=false` |
| CONT-01 | Content variants | local AI fixture/provider test | UNVERIFIED | Provider fixture tests pending |
| CONT-02 | Media metadata/search | indexing test | UNVERIFIED | Media index pending |
| INBOX-01 | Unified conversation model | connector fixture integration | UNVERIFIED | Fixture integration pending |
| CRM-01 | Conversation-contact linking | relational integration test | UNVERIFIED | Relational layer pending |
| SYNC-01 | Offline edits survive restart | device simulation test | UNVERIFIED | Sync transport pending |
| SYNC-02 | Concurrent edits converge | Yjs convergence test | UNVERIFIED | Yjs wiring pending |
| BACK-01 | Encrypted backup | backup/restore test | UNVERIFIED | Backup module pending |
| BACK-02 | Corrupt backup rejected | integrity test | UNVERIFIED | Integrity checks pending |
| CONN-01 | Capability handshake | connector contract test | PASS | `packages/core/test/connectors.test.ts` (handshake accepts/rejects declared vs implemented) |
| CONN-02 | Unsupported action rejected | negative connector test | PASS | `packages/core/test/connectors.test.ts` (executeCapability rejects undeclared capability) |
| CONN-03 | Challenge causes safe stop | browser fixture test | PARTIAL | Logic PASS (`handleChallenge` returns requiresIntervention) in `connectors.test.ts`; browser fixture still pending |
| WEB-01 | PWA manifest/service worker | production browser test | PARTIAL | Production `dist/` contains valid `manifest.webmanifest`, `sw.js`, icons; registration wired in `src/main.tsx` (prod only). Live browser install/offline test pending |
| MOB-01 | Mobile control surface | Expo typecheck/build test | UNVERIFIED | Expo app not yet scaffolded |
| REL-01 | Reproducible workspace install | clean CI checkout | PARTIAL | `package-lock.json` + `packages/core/package-lock.json` committed; CI workflow at `.github/workflows/ci.yml` (needs first green run on GitHub) |
| REL-02 | Signed desktop artifact | release pipeline evidence | UNVERIFIED | Signing keys/pipeline not configured |
| REL-03 | Checksums match distributed artifacts | release verification | PARTIAL | `npm run checksums` writes `dist/SHA256SUMS.txt`; CI uploads artifact; distribution-side match pending |
| OPS-01 | Crash recovery | forced termination test | UNVERIFIED | Persistence layer pending |
| OPS-02 | 24h stability | soak-test evidence | UNVERIFIED | Soak run pending |
| PERF-01 | Startup target | measured benchmark | UNVERIFIED | Benchmark pending |
| PERF-02 | Memory target | measured benchmark | UNVERIFIED | Benchmark pending |
| QA-01 | Unit coverage threshold | coverage report | PASS | `npm run test:coverage --prefix packages/core` enforces thresholds (lines ≥80, funcs ≥80, branches ≥70); latest run ~94% lines on core |
| QA-02 | Critical E2E paths | Playwright report | UNVERIFIED | Playwright suite pending |
| DOC-01 | User guide matches product | documentation review | PARTIAL | `README.md` covers install/run/scripts; full user guide pending product freeze |
| DOC-02 | Security model documented | security review | PASS | `docs/SECURITY_MODEL.md` documents trust boundaries, gates, audit chain, release integrity |

## Gate rules

- Any `FAIL` in SEC, DATA, QUE, CAMP, CONN or REL blocks release.
- Any `UNVERIFIED` runtime requirement blocks the claim "production ready".
- Performance targets are measured, never inferred from code size.
- Real-platform tests must be controlled and must not be used to claim immunity from platform enforcement.

## Current release posture

- No `FAIL` entries.
- Multiple `UNVERIFIED` runtime requirements remain → **not production-ready** claim is blocked per gate rules.
- Core domain gates (approval, retries, circuit breaker, connector handshake, audit chain) are covered by deterministic unit tests.
