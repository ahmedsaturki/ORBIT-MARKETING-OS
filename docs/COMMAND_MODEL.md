# ORBIT Command Model

Updated: 2026-09-26

The Command Registry is the shared intent contract for Desktop, Web, Mobile, CLI, MCP, and bounded Agents. A command describes what may be requested; the governed execution fabric remains responsible for deciding and performing external work.

## Command contract

Every command declares:

- stable ID and human title;
- required authorization scopes;
- risk classification;
- supported surfaces;
- whether it mutates state;
- whether it is externally visible;
- whether approval is mandatory.

## Authorization order

workspace -> command existence -> surface -> required scopes -> approval

A denied decision is explicit and side-effect free. The registry does not invoke connectors and does not bypass policy, safety budgets, or human intervention.

## Command Execution Kernel

The Command Dispatcher is the shared coordination boundary for all ORBIT surfaces. It accepts an already-shaped command invocation, evaluates the registry decision, resolves only a registered handler, and returns an explicit typed result.

Each invocation gets a unique trace ID by default, or uses a caller-supplied trace ID for an already established workflow. The dispatcher emits a bounded lifecycle:

`command.received -> command.authorized|command.blocked -> command.completed`

Raw command input is intentionally never persisted in the operational event payload. Only non-sensitive metadata such as surface and input-presence is retained.

The dispatcher does not execute connectors directly and cannot bypass policy, approval, safety budgets, connector capabilities, or human intervention. External execution remains owned by the existing governed execution fabric.

## Built-in command families

- campaign.plan
- content.draft
- content.approve
- task.execute
- conversation.reply
- analytics.explain
- workflow.simulate
- execution.replay

These are initial canonical commands, not the complete future API. New commands must reuse the same contract instead of adding bespoke UI-only actions.

## Future CLI/MCP mapping

The same command ID remains stable across interfaces. A CLI subcommand, an MCP tool, a desktop action, and an agent tool call can all resolve to the same registry definition and then pass through the same governed command boundary.
