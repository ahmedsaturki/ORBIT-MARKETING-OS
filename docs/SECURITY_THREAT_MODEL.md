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

| Threat | Control |
| --- | --- |
| Credential leakage | encrypted vault, redaction, no secrets in logs |
| Unauthorized external action | approval + execution policy + connector confirmation |
| Cross-workspace data access | workspace-scoped identifiers and persistence queries |
| Replay/double publish | idempotency keys and external-operation evidence |
| Queue corruption | explicit state transitions and recovery tests |
| Connector/UI change | typed connector outcomes and human intervention |
| CAPTCHA/auth challenge | stop and require user intervention |
| Sync disclosure | encrypt secret material before replication |
| Malicious rule pack | schema validation, version compatibility, integrity checks |
| Backup theft | encrypted backup payloads, no plaintext secret export |
| Supply-chain compromise | lockfile, pinned CI actions, dependency audit gate |
| Audit tampering | append-oriented audit model and integrity verification |

## Security invariants

- No plaintext password, cookie, token, or session payload in application logs.
- No connector may bypass the execution policy.
- No external side effect may occur without the required approval state.
- No synchronization transport is trusted with plaintext secret material.
- No workspace may read another workspace's private records.
- Challenge/authorization uncertainty fails closed.
- Security failures are observable through non-sensitive audit events.

## Release gate

A security feature is not complete until its implementation, negative tests, integration path, and release evidence all exist.
