# ORBIT Operating Control

ORBIT's operational control layer turns planning and governed execution into observable,
replayable work.

## Simulation

Simulation evaluates the same agent, policy, approval, risk, and budget gates used by
execution, but it never dispatches a connector action or mutates runtime state.

A simulation result is therefore a decision plan, not a promise that a future platform
action will succeed.

## Replay

Replay consumes immutable execution/audit events and reconstructs the observable
lifecycle state of a task. It never re-runs an external action.

This makes failures diagnosable from:

- decision
- dispatch
- result
- state transition
- human intervention

The trace is workspace- and task-bound and must have contiguous sequence numbers.

## Policy packs

Built-in policy packs provide explicit starting policies for:

- conservative human-led operations
- balanced bounded execution
- agency multi-client operations
- enterprise governed execution
- regulated audit-oriented operation

Every pack carries explicit blocked safety actions and a workspace-scoped materialized
policy identity. Packs are presets, not permission to bypass platform authorization or
anti-abuse controls.

## Design law

Simulation, replay, and policy packs are pure control-plane capabilities over the same
ORBIT operating graph. They do not create a second execution system.

External work remains subject to:

- user authorization
- connector capabilities
- approval requirements
- daily and circuit safety budgets
- human intervention
- auditability
- platform-compliant behavior
