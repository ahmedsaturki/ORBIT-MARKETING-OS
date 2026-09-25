# ORBIT Marketing OS — Target Product Architecture

Updated: 2026-09-26

## Product definition

ORBIT is a private, local-first operating system for marketing work.

It is not defined by the number of connectors, AI models, automation buttons, or dashboard widgets. The product boundary is the complete governed operating loop:

`Strategy → Campaign → Content → Approval → Execution → Engagement → Conversion → Measurement → Learning`

The loop is represented as a first-class Marketing Run inside the local runtime.

## Product pillars

1. **Brain** — strategy, audience, offers, brand knowledge, research, institutional memory.
2. **Work** — campaigns, projects, tasks, approvals, dependencies, queues, operational ownership.
3. **Content** — ideation, briefing, variants, assets, validation, publishing plans, repurposing.
4. **Engage** — conversations, contacts, follow-up, qualification, opportunities.
5. **Execute** — connectors, capability handshakes, governed commands, retries, safe-stop, human intervention.
6. **Intelligence** — analytics, attribution context, anomalies, recommendations, learning.
7. **AI** — local-first copilot/agents with explicit tools, scopes, budgets, approvals and audit.
8. **Governance** — workspace isolation, RBAC, secrets, policy, audit, backup/restore, licensing, release evidence.

## Architectural principles

### One operating graph

Domain entities remain independently typed, but their relationships form one workspace-scoped graph. Features should add nodes, links, or governed operations rather than create isolated mini-products.

### One execution boundary

External side effects travel through explicit commands and typed connector results. AI and workflows cannot silently bypass the execution boundary.

### One source of truth

The desktop/local runtime remains authoritative for private account state, campaigns, queues, CRM data, and audit data. Web and mobile are controlled surfaces.

### One policy model

Agent grants, workflow rules, connector capabilities, approvals, and daily/circuit budgets should resolve through consistent authorization concepts.

### One evidence model

A feature is not release-complete because source code exists. Runtime behavior requires tests, controlled evidence, recovery proof, security proof, performance measurements and user documentation.

## Product family

- ORBIT Desktop — primary operating runtime.
- ORBIT Web — public/product surface plus controlled remote operations.
- ORBIT Mobile — approval, monitoring, interruption recovery and incident control.
- ORBIT AI — local-first intelligence and bounded agents.
- ORBIT Connect — connector and capability runtime.
- ORBIT CLI/MCP — operator and agent interfaces.
- ORBIT Packs — vertical workflows, policies, schemas, dashboards and playbooks.

## Capability expansion policy

New capabilities should be added in this order:

1. Domain contract.
2. Workspace/security boundary.
3. Deterministic core logic.
4. Unit/integration tests.
5. Runtime integration.
6. E2E/recovery evidence.
7. Documentation.
8. Release evidence.
9. Product surface exposure.

Do not add UI-only features that have no underlying governed runtime model.

## Non-goals

ORBIT must not use CAPTCHA bypass, fingerprint spoofing, anti-abuse evasion, fake engagement, unauthorized bulk messaging, or concealed automation as a product moat.

## Initial release expansion sequence

### Phase A — Control Plane
Marketing Run, Mission Control, unified event/replay model, policy-aware work execution.

### Phase B — Intelligence
Knowledge evidence, research, brand/audience memory, analytics/learning loop.

### Phase C — Execution
Connector capability registry, real-platform controlled E2E, challenge recovery, governed automation.

### Phase D — Platform
CLI, MCP, SDK, extensions, vertical packs, distribution/licensing.

The current repository already contains substantial pieces of all four phases; this document defines how they must compose into one product rather than become separate feature islands.
