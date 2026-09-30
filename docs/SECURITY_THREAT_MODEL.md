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
- **The dependency and secret-scanning gates are not behaviorally tested.**
  Lockfile enforcement, pinned action SHAs, and the `pnpm audit` gate run in
  `scripts/verify-workspace.mjs` and CI. `scripts/security-scan.mjs` has no test
  that seeds a fake secret and asserts a non-zero exit, so a regression that
  made the scanner always pass would not be caught by the unit suite.
- **Sync encryption is a library property, not an observed transport
  property.** `encryptSyncUpdate` runs before any `SyncEnvelope` can be
  constructed, so an unencrypted envelope is not representable, and ciphertext
  opacity is asserted in `sync.test.ts` and `sync-network.test.ts`. But no
  shipped replication path calls it: the only callers are tests, whose
  "transport" is an in-memory queue. Trust boundary 4 therefore holds for the
  primitive and is unproven for any real network path.
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
- **Event redaction is duplicated and only half-tested.** The TypeScript and
  Rust redaction implementations are independent; only the TypeScript copy has
  a covering test.
- **Audit tamper detection depends on the chain being the only writer.** The
  chain detects edits to stored records, but nothing binds it to the audit
  event stream, so wholesale replacement of a chain is detected only as a
  broken `previousHash` link — not as a substituted history.
- **The execution policy is a runtime convention, and one live path already
  bypasses it.** `connector.execute()` is public and takes no policy handle.
  `workflows/executionRunner.ts` evaluates `evaluateExecutionPolicy` before
  calling it, but `scripts/commercial-connector-proof.ts` also calls
  `connector.execute()` directly — at the Telegram call and again at the
  LinkedIn call — with a hand-built task and `userConfirmed: true`, and it is
  wired to a workflow that runs with real platform tokens. That path enforces
  only the weaker `assertUserConfirmed` check inside the connector, so approval
  state, daily budget, and circuit breaker are not evaluated for it. Any future
  direct caller would have the same gap.

## Release gate

A security feature is not complete until its implementation, negative tests, integration path, and release evidence all exist.
