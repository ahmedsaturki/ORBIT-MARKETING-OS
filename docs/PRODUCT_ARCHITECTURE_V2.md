# ORBIT Production Architecture v2

## North star

ORBIT is a local-first social operations system, not a collection of disconnected posting tools.

The primary unit is an **Operational Graph**:

`Workspace → Team → Account → Content → Campaign → Task → Conversation → Contact → Outcome → Evidence`

Every mutation is attributable, recoverable and testable.

## Runtime planes

### 1. Control Plane

Responsible for navigation, permissions, configuration, approvals, scheduling and observability.

### 2. Data Plane

SQLite-backed local state, encrypted secret vault, media index, audit log and offline queue.

### 3. Automation Plane

Connector contracts, browser workers where appropriate, task execution, challenge detection, verification and safe cancellation.

### 4. Intelligence Plane

Local AI provider abstraction, content transformation, classification, reply suggestions, analytics insights and retrieval over local workspace data.

### 5. Sync Plane

Encrypted Yjs updates, device identity, conflict resolution, transport abstraction and local-first reconciliation.

### 6. Distribution Plane

Signed desktop releases, mobile builds, web application, update manifests and release evidence.

## Core invariants

1. Credentials and session material never enter analytics events.
2. The renderer never receives unrestricted filesystem/database capabilities.
3. No automation task executes before policy evaluation.
4. Every task has a deterministic lifecycle and terminal state.
5. A connector may expose only capabilities it actually implements.
6. Unknown/changing UI states fail closed and request user intervention.
7. Sync transports carry encrypted application updates, not raw credentials.
8. Local AI is optional at runtime but the content model is provider-independent.
9. Backup restore must verify integrity before replacing active state.
10. Releases are immutable, versioned and checksummed.

## Domain modules

- accounts
- workspaces
- teams
- permissions
- content
- media
- calendars
- campaigns
- workflows
- approvals
- queue
- connectors
- inbox
- contacts
- analytics
- notifications
- AI
- sync
- backup
- licensing
- audit
- settings

## Connector lifecycle

`discover → authorize → validate → capability handshake → execute → verify → audit → disconnect`

A connector can operate in multiple modes:

- official integration where appropriate
- browser-assisted/manual workflow
- local import/export
- notification-assisted publishing

ORBIT must not claim unsupported capabilities merely because a UI can technically be manipulated.

## Safety model

The product uses safety controls for reliability and policy compliance, not evasion of platform detection:

- rate budgets
- daily quotas
- duplicate-content checks
- confirmation gates
- challenge detection
- authentication-expiry detection
- circuit breaker
- cancellation
- retry with bounded backoff
- complete audit history

## UX model

The desktop application is the authoritative operator console. Mobile is a monitoring/control surface. Web is a public/product and lightweight control surface. They share contracts and domain semantics but do not duplicate every runtime capability.

## Release model

`commit → CI → tests → security gates → signed artifacts → release evidence → distribution`

A release is not considered complete until the exact artifact that passed validation is the artifact distributed to users.
