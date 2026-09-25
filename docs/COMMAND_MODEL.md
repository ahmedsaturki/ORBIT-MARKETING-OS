# ORBIT Command Model

Updated: 2026-09-26

The Command Registry is the shared intent contract for Desktop, Web, Mobile, CLI, MCP, and bounded Agents. The governed execution fabric remains responsible for deciding and performing external work.

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

The Command Registry is paired with a shared Command Dispatcher. The dispatcher emits the governed lifecycle `received -> authorized/blocked -> completed`, resolves only registered handlers, and converts handler success/failure into explicit results and operational events. It is a coordination boundary, not a connector executor, and cannot bypass policy, approval, safety budgets, or human intervention.

The same command ID is intended to remain stable across interfaces so a desktop action, web action, mobile action, CLI command, MCP tool, or bounded agent call can resolve to the same governed definition.

## Initial command families

- campaign.plan
- content.draft
- content.approve
- task.execute
- conversation.reply
- analytics.explain
- workflow.simulate
- execution.replay

New commands should reuse this contract rather than creating bespoke surface-specific actions.
