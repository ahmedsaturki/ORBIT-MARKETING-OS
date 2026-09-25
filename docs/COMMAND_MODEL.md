# ORBIT Command Model

Updated: 2026-09-26

The Command Registry is the shared intent contract for Desktop, Web, Mobile, CLI, MCP, and bounded Agents. A command describes what may be requested; the existing governed execution fabric remains responsible for deciding and performing external work.

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

The same command ID must remain stable across interfaces. A CLI subcommand, an MCP tool, a desktop action, and an agent tool call can all resolve to the same registry definition and then pass through the existing execution/policy/approval gates.
