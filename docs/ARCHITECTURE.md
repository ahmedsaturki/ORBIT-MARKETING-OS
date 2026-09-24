# ORBIT MARKETING OS — Architecture

## Current state

The repository started as a single Vite + React + Express prototype. The implementation branch is migrating it incrementally to a local-first monorepo without breaking the existing UI before replacements are verified.

## Target boundaries

```
packages/
  core/        Shared domain, security, queues, campaign rules
  desktop/     Tauri v2 shell + local connector host
  mobile/      React Native / Expo monitoring client
  web/         Next.js public/product web and limited control surface
  shared-ui/   Cross-surface presentational primitives
```

## Data ownership

The desktop/local runtime is the system of record for account connection state, campaigns, task queues, CRM records, audit events, and encrypted local media references.

The web surface must not become a hidden server-side vault for credentials or browser sessions.

## Integration boundary

Platform connectors are isolated from domain logic. A connector receives an explicit command, reports a typed result, and cannot silently execute work outside a user-authorized workflow.

Preferred order:

1. supported official platform integrations where available;
2. user-authorized browser sessions when appropriate and compliant;
3. manual/user-assisted recovery for CAPTCHA, authentication challenges, or changed UI.

The product does not attempt to defeat anti-abuse controls, evade detection, spoof fingerprints, bypass CAPTCHAs, or conceal automation from a platform.

## Security boundary

```
user secret
   ↓
platform-specific KDF / vault key
   ↓
AES-256-GCM encrypted records
   ↓
local SQLite / local files
```

The shared TypeScript package contains the authenticated AES-256-GCM primitive, credential redaction, and workspace authorization contracts. The desktop runtime provides native Argon2id, encrypted storage, and a persisted active-workspace context.

## Sync boundary

CRDT synchronization is a replication layer, not the authority for secrets. Secret material remains encrypted before entering any sync transport.

## Observability

Logs contain event IDs, timestamps, component names, and non-sensitive outcomes. Tokens, cookies, passwords, session data, and API keys are redacted.

## Definition of done

A feature is complete only after implementation, automated tests, build/typecheck/lint, security review, documentation, and acceptance evidence all agree.


## Current desktop workspace model

The core domain and desktop runtime are workspace-aware. Tauri persists an active workspace identifier locally and exposes workspace list/create/select commands; every workspace-scoped operation resolves against that active context. End-to-end multi-user identity/RBAC remains a separate release gate.

External platform actions are gated by account/campaign/task integrity, approval, local safety limits, explicit user authorization, connector capabilities, and challenge handling.

### Human intervention lifecycle

Externally visible tasks can be parked in `awaiting_user_action` when the user must confirm, re-authorize, or resolve a platform challenge. The task is not eligible for worker claiming until the user explicitly resumes it. Approval requirements use the separate `awaiting_approval` state.
