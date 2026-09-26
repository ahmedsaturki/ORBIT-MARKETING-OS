# ORBIT CLI + MCP Surfaces

Updated: 2026-09-26

## Purpose

ORBIT exposes controlled operator and developer surfaces without creating a second execution system.

The CLI and MCP adapters project the canonical Command Registry. Their read-only preview path uses
the same workspace, scope, surface, and approval decision logic as native dispatch.

## CLI

Examples:

```bash
pnpm orbit commands list --surface cli
pnpm orbit commands get analytics.explain
pnpm orbit command preview task.execute --workspace ws-1 --actor user-1 --scopes task:execute
```

A denied preview is expected when an externally visible mutable command still requires approval.
The CLI does not directly execute connector work.

## MCP

Start the stdio server:

```bash
pnpm orbit:mcp
```

The server implements JSON-RPC 2.0 stdio handling for MCP discovery and exposes:

- `orbit.commands.list`
- `orbit.command.preview`

Both are non-dispatching surfaces. Actual command execution remains owned by the canonical runtime
and must go through its normal policy, approval, budget, connector-capability, and human-intervention
boundaries.

## Security contract

No tokens, cookies, browser sessions, or raw command inputs are placed into the operational event
spine by these adapters. The adapters do not bypass authorization, CAPTCHA, anti-abuse controls,
or platform capability checks.

## Release gate

A future executable MCP/CLI action surface may be added only when its handler is bound to the same
CommandDispatcher and runtime persistence used by desktop operations. A parallel direct execution
path is prohibited.
