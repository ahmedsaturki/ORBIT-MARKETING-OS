# ORBIT Target Product Blueprint

Updated: 2026-09-25

## Product thesis

ORBIT is not a social scheduler with extra features. It is a private, local-first operating layer for marketing work.

The operating graph is:

```
Strategy → Campaign → Audience → Content → Approval → Work Queue
    → Connector Execution → Conversation → CRM → Outcome
    → Analytics → Learning → next Strategy
```

Every operational object is workspace-scoped, auditable, policy-governed, and recoverable.

## Product systems

### ORBIT Brain

Strategy, brand memory, audiences, offers, positioning, approved messaging, competitor intelligence, research, and institutional memory.

### ORBIT Work

Objectives, initiatives, campaigns, tasks, approvals, dependencies, ownership, escalation, and a universal work queue.

### ORBIT Content

Ideas → briefs → variants → media → QA → approval → distribution → repurposing → measurement.

### ORBIT Engage

Cross-channel conversations, contact identity, assignment, follow-up, intervention, and conversion context.

### ORBIT CRM

Contacts, lifecycle, intent, source, campaign context, opportunities, tasks, and outcome history.

### ORBIT Automation

Event → rule → decision → policy → action → verification → state transition.

Automation must not bypass authorization, safety budgets, platform controls, or required human intervention.

### ORBIT Intelligence

Research, knowledge grounding, analytics, anomaly detection, experiment learning, and next-action recommendations.

### ORBIT Agents

Bounded agents with explicit goals, tool grants, scopes, knowledge boundaries, step budgets, autonomy modes, approvals, and auditability.

### ORBIT Execution Fabric

Official integrations first; compliant user-authorized browser execution where appropriate; user-assisted recovery for authentication, CAPTCHA, or changed UI.

Every connector exposes capabilities and typed results rather than leaking platform-specific behavior into product domains.

## Core architectural laws

1. Local runtime owns sensitive account state, private CRM data, task queues, campaigns, audit history, and encrypted media references.
2. The web surface is not a hidden credential or browser-session vault.
3. Secrets stay encrypted before sync transport and are never emitted into logs or analytics.
4. External actions are policy evaluated before execution.
5. AI is an operator inside the same governed runtime, not a second uncontrolled application.
6. Human intervention and approval are explicit states.
7. Runtime behavior is proven with tests and evidence; source presence is not runtime proof.
8. ORBIT does not implement CAPTCHA bypass, fingerprint spoofing, stealth evasion, concealed automation, or unauthorized bulk actions.

## Surfaces

- Desktop: system of record, full operations, native storage, connector host, local AI.
- Web: public/product surface plus controlled remote operations.
- Mobile: approvals, monitoring, interventions, alerts, emergency stop.
- CLI: operator/developer access to the same domain contracts.
- MCP: governed AI-tool interface with scopes and approvals.
- SDK: future connector, workflow, agent, and extension ecosystem.

## Product maturity ladder

### Foundation

Domain contracts, secure local persistence, workspace isolation, queue/recovery, connector contracts, policy engine.

### Core Operations

Strategy, content, campaigns, approvals, CRM, inbox, tasks, analytics, backups.

### Intelligence

Knowledge fabric, research, local AI routing, agents, learning loop, anomaly detection.

### Platform

CLI, MCP, connector SDK, agent SDK, extension model, vertical packs.

### Commercial

Signed releases, reproducible artifacts, update/rollback, licensing, distribution, billing, legal/commercial readiness.

## Release definition

A capability is production-ready only when implementation, tests, security invariants, recovery paths, documentation, and runtime evidence agree.

`IMPLEMENTED` is not `VERIFIED`.

`VERIFIED` is not `PRODUCTION PROVEN`.

Commercial launch remains blocked while release-critical runtime, connector, distribution, signing, rollback, accessibility, soak, governance, or billing evidence is missing.
