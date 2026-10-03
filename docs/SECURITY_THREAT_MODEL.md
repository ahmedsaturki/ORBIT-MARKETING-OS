# ORBIT MARKETING OS — Security Threat Model

## Security objective

Protect user-owned credentials, authenticated sessions, customer data, media, campaign data, and audit history while keeping the desktop runtime authoritative.

## Assets

- platform credentials and authenticated session material
- customer/contact records
- private messages and conversation history
- campaign/content data
- encrypted local media
- license material
- audit records
- synchronization state

## Trust boundaries

1. UI → application commands
2. application → local persistence
3. application → connector runtime
4. local device → optional synchronization transport
5. application → optional AI provider

Secrets must never cross a boundary unless that boundary is explicitly part of the user's configured trust model.

## Threats and required controls

| Threat                       | Control                                                    |
| ---------------------------- | ---------------------------------------------------------- |
| Credential leakage           | encrypted vault, redaction, no secrets in logs             |
| Unauthorized external action | approval + execution policy + connector confirmation       |
| Cross-workspace data access  | workspace-scoped identifiers and persistence queries       |
| Replay/double publish        | idempotency keys and external-operation evidence           |
| Queue corruption             | explicit state transitions and recovery tests              |
| Connector/UI change          | typed connector outcomes and human intervention            |
| CAPTCHA/auth challenge       | stop and require user intervention                         |
| Sync disclosure              | encrypt secret material before replication                 |
| Malicious rule pack          | schema validation, version compatibility, integrity checks |
| Backup theft                 | encrypted backup payloads, no plaintext secret export      |
| Supply-chain compromise      | lockfile, pinned CI actions, dependency audit gate         |
| Audit tampering              | append-oriented audit model and integrity verification     |

## Security invariants

- No plaintext password, cookie, token, or session payload in application logs.
- No connector may bypass the execution policy.
- No external side effect may occur without the required approval state.
- No synchronization transport is trusted with plaintext secret material.
- No workspace may read another workspace's private records.
- Challenge/authorization uncertainty fails closed.
- Security failures are observable through non-sensitive audit events.

## Known gaps

These are standing limitations of the controls above, not review notes. They do
not expire when a review is re-run; each one bounds what a passing test suite
actually proves.

- **Rule-pack "integrity checks" are a schema gate, not a tamper gate.**
  Schema validation, version pinning, unique-id and platform checks, and the
  confirmation requirement are implemented and tested in `automation/rules.ts`
  and mirrored by the Rust validator. No digest or signature verification of a
  rule pack exists anywhere in the repository, so an attacker who can write the
  pack file is not detected by these controls.
- **The scanner is behaviorally tested; what it can reach is bounded by
  `git ls-files`.** `scripts/security-scan.test.mjs` is a five-case behavioral
  contract that copies the shipped scanner into a throwaway repository and
  asserts: a clean repository exits 0 with a machine-readable summary; an
  embedded credential in a tracked file exits 1 and names the file; a tracked
  non-example `.env` is treated as a secret; `.env.example` stays allowed; and
  PEM private-key material exits 1. It runs in CI as
  `pnpm test:security:scan`. The remaining gap is reach, not behavior: the
  scanner enumerates `git ls-files`, so an untracked working-tree file or a
  secret that exists only in git history is outside its scope. Separately,
  `pnpm audit` is not invoked by `scripts/verify-workspace.mjs`; it runs in
  `ci.yml`, `release-desktop.yml`, `release-mobile.yml`,
  `self-hosted-verify.yml` and `web-release-selfhosted.yml`.
- **Sync encryption is a library property, and no shipped replication path
  calls it.** `encryptSyncUpdate` runs before any `SyncEnvelope` can be
  constructed, so an unencrypted envelope is not representable.
  `sync-network.test.ts` exercises two devices over a real `node:http`
  loopback relay, asserting convergence and tampering rejection before any
  state is applied, so the transport is no longer an in-memory queue. The
  residual gap is narrower: the only callers of `encryptSyncUpdate` are
  `src/sync/yjs.ts` and two test files, so trust boundary 4 holds for the
  primitive and for the test relay, and remains unproven for a real
  multi-device network.
- **Challenge handling fails closed structurally, not by the named control.**
  `handleChallenge` has no production caller. The connectors themselves emit a
  `ConnectorOutcome` whose reason is `authorization_required`,
  `platform_limit`, or `delivery_status_unknown`; the transition to
  `awaiting_user_action` is performed by the queue layer
  (`queue/taskQueue.ts`) and the workflow executor, not by any code under
  `connectors/`. The end-to-end behavior is fail-closed, but the DOM-scraping
  helper named in the table is a test-only utility.
- **Workspace scoping rests on ambient process-global state.** The active
  workspace is a process-wide lock, so isolation means "the workspace currently
  selected in this process" rather than a caller-proven identity. Defensible
  for a single-user local desktop runtime; it is not per-request authorization
  and must not be relied on as such.
- **Event redaction is duplicated, and the two implementations can drift.**
  The TypeScript and Rust redaction paths are independent. Both are covered
  today — the TypeScript copy by its own suite, and the Rust
  `redact_event_json` by `redact_event_json_replaces_credential_values`,
  `redact_event_json_leaves_non_sensitive_values_intact`, and
  `redact_event_json_walks_nested_objects_and_arrays` — but nothing asserts the
  two redact the same key set, so a key added to one side can silently be
  absent from the other.
- **Audit tamper detection depends on the chain being the only writer, and
  the TypeScript chain is not the persisted one.** The TypeScript
  `AuditIntegrityChain` holds an in-memory array; the cases added to its test
  file exercise the verification logic, not the tampering of stored records.
  The persisted, tamper-relevant chain is the Rust `verify_audit_chain`, which
  has its own negative test (`audit_chain_helper_rejects_tampered_rows`)
  updating a row directly and asserting verification fails. Even there,
  nothing binds the chain to the audit event stream, so wholesale replacement
  of a chain is detected only as a broken `previousHash` link — not as a
  substituted history.
- **The execution policy is a runtime convention enforced at every known call
  site, not a property of the connector.** `connector.execute()` is public and
  takes no policy handle; `workflows/executionRunner.ts` evaluates
  `evaluateExecutionPolicy` before calling it. `scripts/commercial-connector-proof.ts`
  previously called `connector.execute()` directly — at the Telegram call and
  again at the LinkedIn call — with a hand-built task and `userConfirmed: true`,
  on a path wired to real platform tokens, so approval state, daily budget, and
  circuit breaker were never evaluated there. Both call sites now evaluate
  `evaluateExecutionPolicy` with explicit policy inputs, and
  `packages/core/test/commercialProofPolicy.test.ts` asserts the connector is
  never invoked when the policy blocks (`campaign_not_runnable`,
  `daily_limit_reached`, `circuit_breaker_open`). The structural risk stands for
  any future direct caller that skips the gate, because the connector itself
  cannot enforce it.
- **Command execution hardening is applied site-by-site, not by type.**
  `scripts/lib/exec.mjs` resolves every spawned binary through an allowlist and
  throws `UntrustedExecutableError` outside it, and the nine highest-risk
  callers (release resolution, evidence collection, security scan, recovery
  evidence, release triage, startup benchmark) now use it. The remaining
  callers still spawn by name: `scripts/soak.ts`,
  `scripts/build-tauri.mjs`, `scripts/commit-lockfiles.mjs`, and several
  `*.test.mjs` fixtures. A new spawn site therefore fails open until someone
  converts it.
- **Outbound fetches are allowlisted per script, not centrally enforced.**
  `scripts/verify-public-vercel-provenance.mjs` validates `ORBIT_LIVE_URL`
  against an explicit host allowlist, requires HTTPS, refuses redirects, and
  sanitizes every value it echoes; `scripts/verify-public-vercel-provenance.test.mjs`
  drives loopback, cloud-metadata, userinfo-embedded, and prefix-trick hosts
  through the real script and asserts each is refused before any request. That
  is one script fixed one way. There is no shared HTTP client carrying the
  allowlist, so the next script that fetches an env-derived URL can reintroduce
  the same sink.

## Release gate

A security feature is not complete until its implementation, negative tests, integration path, and release evidence all exist.
