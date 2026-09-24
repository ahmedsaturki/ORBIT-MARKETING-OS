# ORBIT Security Model

Status: living document. Maps directly to `docs/ACCEPTANCE_MATRIX_V2.md` SEC-* and invariant list in `docs/PRODUCT_ARCHITECTURE_V2.md`.

## Trust boundaries

| Boundary | Rule |
|---|---|
| Renderer ↔ secrets | Renderer never receives raw credentials or unrestricted FS/DB capability. |
| App ↔ analytics | Credentials and session material never enter analytics events. |
| App ↔ sync transport | Sync carries encrypted application updates only, never raw credentials. |
| Automation ↔ platforms | Unknown/changing UI states fail closed and request user intervention. |
| Restore ↔ active state | Backup integrity is verified before replacing active state. |

## Secret handling

- Local `.env` files are gitignored (`.env.example` documents required keys without values).
- Encryption at rest for stored secrets (SEC-01) is implemented by `packages/core/src/security/vault.ts` (AES-256-GCM, scrypt-derived key, atomic writes, fail-closed on wrong passphrase/tamper) and verified by `test/security-vault.test.ts` (cryptographic tests + restore test).
- Redaction of secrets from logs/analytics (SEC-02) is implemented by `packages/core/src/security/redaction.ts`, wired into `server.ts` error/warning logs, and verified by `test/security-redaction.test.ts` (redaction tests + sentinel log scan).

## Approval and policy gates

- Content cannot publish without explicit approval evidence (`packages/core/src/workflows/approval.ts`). Fail-closed: missing approval blocks publish.
- Automation tasks are gated by `evaluatePolicy` + `gateTaskForExecution` before dispatch. Missing evaluator blocks execution.

## Circuit breaker and rate budgets

- Per-account daily limits enforced by policy (`daily_limit`).
- Circuit breaker opens after N consecutive errors and blocks dispatch until half-open.
- Challenge detection (CAPTCHA, login required, checkpoints) stops automation and requests intervention.

## Connector capability model

- Handshake fails if a connector declares capabilities it does not implement.
- Executing an undeclared/unconfirmed capability is rejected.
- Only implemented capabilities can be exposed in UI.

## Audit chain

- Every audit entry includes `prevHash` and SHA-256 `hash` over a normalized payload.
- `verifyChain` detects tampering and broken links.
- Entries are append-only in the application model.

## Release integrity

- `npm run checksums` writes `dist/SHA256SUMS.txt`.
- CI verifies dist artifacts and uploads checksums as build evidence (REL-03 requires checksums to match distributed artifacts — distribution-side verification still pending).

## Out of scope / not claimed

- ORBIT does not claim immunity from platform enforcement.
- Safety controls are for reliability and policy compliance, not detection evasion.
- Signed desktop artifacts (REL-02) require a release pipeline with signing keys — not yet configured.
