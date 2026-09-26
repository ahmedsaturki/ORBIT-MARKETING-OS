#!/usr/bin/env tsx

import * as readline from "node:readline";
import {
  CommandRegistry,
  listCommandsForSurface,
  previewCommandInvocation,
} from "../packages/core/src/index.ts";

const registry = new CommandRegistry();

type RpcRequest = {
  readonly jsonrpc?: string;
  readonly id?: string | number | null;
  readonly method?: string;
  readonly params?: Record<string, unknown>;
};

function write(
  id: string | number | null | undefined,
  result?: unknown,
  error?: { code: number; message: string },
): void {
  const payload = error
    ? { jsonrpc: "2.0", id: id ?? null, error }
    : { jsonrpc: "2.0", id: id ?? null, result };
  process.stdout.write(JSON.stringify(payload) + "\n");
}

function stringParam(
  params: Record<string, unknown>,
  name: string,
  fallback = "",
): string {
  const value = params[name];
  return typeof value === "string" ? value : fallback;
}

function stringArrayParam(
  params: Record<string, unknown>,
  name: string,
): string[] {
  const value = params[name];
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

async function handle(request: RpcRequest): Promise<void> {
  if (request.jsonrpc !== "2.0") {
    write(request.id, undefined, { code: -32600, message: "invalid_jsonrpc" });
    return;
  }

  if (request.method === "initialize") {
    write(request.id, {
      protocolVersion: "2024-11-05",
      serverInfo: { name: "orbit-governed-surface", version: "0.2.0" },
      capabilities: { tools: {} },
    });
    return;
  }

  if (request.method === "notifications/initialized") return;

  if (request.method === "tools/list") {
    write(request.id, {
      tools: [
        {
          name: "orbit.commands.list",
          description:
            "List commands exposed to the MCP surface without granting permissions.",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
        },
        {
          name: "orbit.command.preview",
          description:
            "Preview canonical command authorization. This never executes or mutates state.",
          inputSchema: {
            type: "object",
            properties: {
              commandId: { type: "string" },
              workspaceId: { type: "string" },
              actorId: { type: "string" },
              grantedScopes: { type: "array", items: { type: "string" } },
              approvalGranted: { type: "boolean" },
            },
            required: ["commandId", "workspaceId", "actorId"],
            additionalProperties: false,
          },
        },
      ],
    });
    return;
  }

  if (request.method === "tools/call") {
    const params = request.params ?? {};
    const name = stringParam(params, "name");
    const args =
      typeof params.arguments === "object" &&
      params.arguments !== null &&
      !Array.isArray(params.arguments)
        ? (params.arguments as Record<string, unknown>)
        : {};

    if (name === "orbit.commands.list") {
      write(request.id, {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              surface: "mcp",
              commands: listCommandsForSurface("mcp", registry),
            }),
          },
        ],
      });
      return;
    }

    if (name === "orbit.command.preview") {
      const commandId = stringParam(args, "commandId");
      const workspaceId = stringParam(args, "workspaceId");
      const actorId = stringParam(args, "actorId");
      if (!commandId || !workspaceId || !actorId) {
        write(request.id, undefined, {
          code: -32602,
          message: "commandId_workspaceId_actorId_required",
        });
        return;
      }

      const preview = previewCommandInvocation({
        commandId,
        workspaceId,
        actorId,
        grantedScopes: stringArrayParam(args, "grantedScopes"),
        approvalGranted: args.approvalGranted === true,
        surface: "mcp",
        registry,
      });

      write(request.id, {
        content: [{ type: "text", text: JSON.stringify(preview) }],
        isError: !preview.decision.allowed,
      });
      return;
    }

    write(request.id, undefined, {
      code: -32601,
      message: "method_not_found",
    });
    return;
  }

  write(request.id, undefined, { code: -32601, message: "method_not_found" });
}

const input = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

for await (const line of input) {
  if (!line.trim()) continue;
  try {
    await handle(JSON.parse(line) as RpcRequest);
  } catch (error) {
    write(null, undefined, {
      code: -32700,
      message: error instanceof Error ? error.message : "parse_error",
    });
  }
}
