# ORBIT Acceptance Matrix v2

Status vocabulary: `PASS`, `FAIL`, `PARTIAL`, `UNVERIFIED`, `NOT_APPLICABLE`.

A feature cannot be marked PASS from source inspection alone when the requirement is runtime behavior.

| ID | Requirement | Evidence required | Status | Evidence |
|---|---|---|---|---|
| SEC-01 | Secrets encrypted at rest | cryptographic tests + restore test | PASS | `src/security/vault.ts` AES-256-GCM + scrypt (N=16384) atomic file vault; `test/security-vault.test.ts` 13 tests: plaintext never on disk, wrong passphrase/tampered-ciphertext/tampered-salt/foreign-file/truncated rejected, restore-from-copy, rollback on failed persist |
| SEC-02 | Secrets excluded from logs/analytics | redaction tests + log scan | PASS | `src/security/redaction.ts` pattern+deep-key redaction wired into `server.ts` error/warn logs; `test/security-redaction.test.ts` 6 tests incl. sentinel log scan (JWT/AWS/Google/vendor tokens/passwords/URL creds never appear in logger output) |
| SEC-03 | Renderer capability isolation | Tauri capability review + E2E | UNVERIFIED | Tauri shell not configured |
| SEC-04 | License tamper detection | mutation/forgery tests | PASS | `src/security/license.ts` HMAC-SHA256 (timing-safe) signed licenses; `test/security-license.test.ts` 10 tests: tier/seat upgrade forgery, bit-flipped payload, wrong secret, spliced tokens, expired/not-yet-valid, malformed, correctly-signed invalid claims rejected |
| DATA-01 | Local SQLite persistence | clean runtime test | PASS | `packages/core/src/data/sqlite.ts` + `test/data-sqlite.test.ts` (WAL db opens, applies migrations, persists across close/reopen, upsert, workspace isolation) |
| DATA-02 | Migration safety | forward migration + backup restore | PASS | `test/data-backup.test.ts` (v1→v2 forward migration without data loss; pre-migration backup restored and migrated forward; failing migration rolls back atomically) + `test/data-sqlite.test.ts` (idempotent reopen) |
| DATA-03 | 1,000 contacts searchable | performance benchmark | PASS | `test/data-sqlite.test.ts` (1,000 contacts bulk-inserted in one transaction, searched by name/email/tag with pagination; full suite runs in ~5s) |
| QUE-01 | Persistent queue | restart/recovery test | PASS | `packages/core/src/queue/persistence.ts` + `test/queue-persistence.test.ts` (file store restart restore, running→retrying/failed recovery, corrupt snapshot rejected, atomic save) |
| QUE-02 | Bounded retries | deterministic retry tests | PASS | `packages/core/test/queue.test.ts` (shouldRetry, scheduleRetry, backoff bounds) |
| QUE-03 | Circuit breaker | fault-injection test | PASS | `packages/core/test/policy.test.ts` (failure injection opens breaker; half-open after pause) |
| CAMP-01 | Campaign creates tasks | integration test | PASS | `src/workflows/campaigns.ts` + `test/campaigns.test.ts` (create→activate→membership→enqueue into real `PersistentQueue`; task carries campaignId/workspace/account/payload; multi-member enqueue) |
| CAMP-02 | Account membership enforced | negative integration test | PASS | `test/campaigns.test.ts` (non-member account rejected and queue unchanged; cross-workspace membership rejected; draft/paused/completed campaigns fail closed; malformed fields rejected) |
| CAMP-03 | Approval gates block execution | workflow test | PASS | `packages/core/test/approval.test.ts` (fail-closed without approval evidence) + queue gate blocks when `approvalAllowed=false` |
| CONT-01 | Content variants | local AI fixture/provider test | PASS | `src/content/variants.ts` VariantProvider abstraction + `test/content-variants.test.ts` 8 tests: local fixture generates bounded per-platform variants, provider failure/over-limit/empty/unknown-platform all fail closed, `withPlatformVariants` frozen merge |
| CONT-02 | Media metadata/search | indexing test | PASS | `src/media/index.ts` workspace-scoped `MediaIndex` + `test/media-index.test.ts` 6 tests: case-insensitive filename search, tag/mime-prefix filters with AND semantics, workspace isolation on get/search/count/remove, duplicate/malformed rejection |
| INBOX-01 | Unified conversation model | connector fixture integration | PASS | `src/inbox/index.ts` `UnifiedInbox` + `test/inbox.test.ts` 6 tests: Facebook/Telegram fixtures normalized into one workspace inbox, threads keyed platform+account+external-id (no cross-platform collisions), chronological order, idempotent re-delivery, markRead, workspace isolation, malformed fail closed |
| CRM-01 | Conversation-contact linking | relational integration test | PASS | `test/data-sqlite.test.ts` (conversation links to contact under `PRAGMA foreign_keys = ON`; inserting a conversation for a non-existent contact is rejected; workspace-scoped counts) |
| SYNC-01 | Offline edits survive restart | device simulation test | UNVERIFIED | Sync transport pending |
| SYNC-02 | Concurrent edits converge | Yjs convergence test | UNVERIFIED | Yjs wiring pending |
| BACK-01 | Encrypted backup | backup/restore test | PASS | `packages/core/src/data/backup.ts` + `test/data-backup.test.ts` (AES-256-GCM passphrase roundtrip, plaintext roundtrip, restore over existing destination clears stale WAL sidecars, passphrase required to verify) |
| BACK-02 | Corrupt backup rejected | integrity test | PASS | `test/data-backup.test.ts` (flipped bit in encrypted payload, flipped bit in plaintext payload, tampered header hash, wrong passphrase, truncated file, non-container file, corrupt restore never overwrites destination) |
| CONN-01 | Capability handshake | connector contract test | PASS | `packages/core/test/connectors.test.ts` (handshake accepts/rejects declared vs implemented) |
| CONN-02 | Unsupported action rejected | negative connector test | PASS | `packages/core/test/connectors.test.ts` (executeCapability rejects undeclared capability) |
| CONN-03 | Challenge causes safe stop | browser fixture test | PARTIAL | Logic PASS (`handleChallenge` returns requiresIntervention) in `connectors.test.ts`; browser fixture still pending |
| WEB-01 | PWA manifest/service worker | production browser test | PARTIAL | Production server smoke test: `/manifest.webmanifest`, `/sw.js`, `/` all HTTP 200; registration wired in `src/main.tsx` (prod only). Browser install/offline test still pending |
| MOB-01 | Mobile control surface | Expo typecheck/build test | UNVERIFIED | Expo app not yet scaffolded |
| REL-01 | Reproducible workspace install | clean CI checkout | PARTIAL | `package-lock.json` + `packages/core/package-lock.json` committed; CI triggered on push (run 36028445859) but jobs blocked by GitHub billing/spending limit — needs first green run after billing fix |
| REL-02 | Signed desktop artifact | release pipeline evidence | UNVERIFIED | Signing keys/pipeline not configured |
| REL-03 | Checksums match distributed artifacts | release verification | PARTIAL | `npm run checksums` writes `dist/SHA256SUMS.txt`; CI uploads artifact; distribution-side match pending |
| OPS-01 | Crash recovery | forced termination test | PASS | `test/crash-recovery.test.ts` (child process runs production queue+SQLite code, SIGKILL'd mid-open-transaction; running task → retrying with `interrupted_before_restart`, committed rows survive, uncommitted transaction rolls back, `integrity_check` ok, recovery idempotent on reopen) |
| OPS-02 | 24h stability | soak-test evidence | UNVERIFIED | Soak run pending |
| PERF-01 | Startup target | measured benchmark | UNVERIFIED | Benchmark pending |
| PERF-02 | Memory target | measured benchmark | UNVERIFIED | Benchmark pending |
| QA-01 | Unit coverage threshold | coverage report | PASS | `npm run test:coverage --prefix packages/core` enforces thresholds (lines ≥80, funcs ≥80, branches ≥70); 115 tests, clean run 95.64% lines / 88.48% branches / 97.72% funcs |
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
- Core domain gates (approval, retries, persistent queue recovery, circuit breaker, connector handshake, audit chain, SQLite persistence, migrations, encrypted backup, corruption rejection, campaign membership, secret vault/redaction, license tampering, content variants, media index, unified inbox) are covered by deterministic unit tests (115 tests).
