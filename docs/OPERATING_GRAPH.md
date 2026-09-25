# ORBIT Operating Graph

Updated: 2026-09-25

The operating graph is the structural spine of ORBIT. It prevents core modules from becoming disconnected feature islands.

## Canonical flow

```
Strategy
  ↓
Campaign
  ↓
Content
  ↓
Approval / Work Queue
  ↓
Connector Execution
  ↓
Conversation
  ↓
CRM / Contact
  ↓
Opportunity
  ↓
Analytics / Insight
  ↓
Learning
  ↓
next Strategy
```

The core graph kernel provides:

- immutable node/link composition;
- workspace-boundary validation;
- dangling-reference detection;
- duplicate node/link detection;
- self-link rejection;
- directional relationship traversal;
- orphan detection;
- a canonical operating-flow vocabulary.

The graph is a coordination model, not a replacement for the authoritative stores. SQLite remains the local system of record, while the graph provides the typed relationship layer used by planning, work, execution, CRM, analytics, and AI.

## Design rules

1. Every graph node belongs to exactly one workspace.
2. Every link resolves to existing nodes in the same workspace.
3. Graph mutations are immutable at the core API boundary.
4. Relations are opaque but syntax-validated, allowing domain modules to introduce new relations without changing the kernel.
5. The canonical operating flow is a recognized ordering, not a mandatory path for every object.
6. Graph state never carries raw secrets, cookies, passwords, access tokens, or browser sessions.
7. AI and automation consume graph context through scoped reads and policy-gated writes.
8. The graph must remain reconstructible from authoritative domain data and audit events.

## Why this matters

ORBIT's product promise is not the number of screens. It is the ability to answer, with context:

> What are we trying to achieve?
>
> What campaign is running?
>
> What content is being executed?
>
> Who interacted?
>
> What happened next?
>
> What did we learn?

The operating graph is the foundation for answering those questions consistently across desktop, web, mobile, CLI, and future agent/extension surfaces.
