# ORBIT Operational Event Model

Updated: 2026-09-26

The Operational Event Spine is the local runtime's append-only coordination trace. It is intentionally different from the compliance-oriented AuditLog.

## Responsibilities

- record command/work/connector/approval/intervention lifecycle events;
- preserve contiguous per-workspace ordering;
- connect related events with parent and trace identifiers;
- provide deterministic read/query surfaces for replay and diagnostics;
- redact credential-like payload fields before storage or telemetry.

## Invariants

1. Every event belongs to exactly one workspace.
2. Sequence numbers are contiguous within an event-log instance.
3. A parent event must already exist in the same workspace before it can be referenced.
4. Event appends never execute external actions.
5. Payloads are copied defensively; nested values cannot mutate the stored event.
6. Event traces do not replace SQLite or the audit chain as authoritative storage.

## Lifecycle example

command.received -> command.authorized -> work.created -> connector.dispatched -> connector.result -> command.completed

A blocked path is explicit: command.received -> command.blocked, while human intervention is represented with human.intervention_required and can later be followed by a resumed command trace.

## Persistence

SQLite remains the source of truth. The desktop runtime now persists the exact logical contract (`workspace_id`, `sequence`, `trace_id`, `parent_event_id`, kind, outcome, actor identity, and redacted payload) in the current schema v14, with workspace/time, entity, and trace indexes. The event table contains no raw secrets by design.

## Verification contract

The current event table, native append/list commands, schema migration, workspace checks, payload redaction, and deep-copy tests are release-gated. No operational event capability is considered verified until exact-head CI and native validation pass.
