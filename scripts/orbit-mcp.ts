#!/usr/bin/env tsx

import * as readline from "node:readline";
import {
  CommandRegistry,
  listCommandsForSurface,
  previewCommandInvocation,
} from "../packages/core/src/index.ts";

const registry = new CommandRegistry();

let legacyInitialized = false;

const SERVER_NAME = "orbit-governed-surface";
const SERVER_VERSION = "0.2.0";
const MODERN_PROTOCOL_VERSION = "2026-07-28";
const LATEST_HANDSHAKE_PROTOCOL_VERSION = "2025-11-25";
const HANDSHAKE_PROTOCOL_VERSIONS = [
  "2024-11-05",
  "2025-03-26",
  "2025-06-18",
  "2025-11-25",
] as const;

type RpcRequest = {
  readonly jsonrpc?: string;
  readonly id?: string | number | null;
  readonly method?: string;
  readonly params?: Record<string, unknown>;
};

type ModernMeta = {
  readonly "io.modelcontextprotocol/protocolVersion"?: unknown;
  readonly "io.modelcontextprotocol/clientCapabilities"?: unknown;
  readonly "io.modelcontextprotocol/clientInfo"?: unknown;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function modernMeta(params: Record<string, unknown>): ModernMeta | undefined {
  const value = params._meta;
  return isRecord(value) ? (value as ModernMeta) : undefined;
}

function isModernRequest(params: Record<string, unknown>): boolean {
  return (
    modernMeta(params)?.["io.modelcontextprotocol/protocolVersion"] ===
    MODERN_PROTOCOL_VERSION
  );
}

function assertModernRequest(
  params: Record<string, unknown>,
): string | undefined {
  const meta = modernMeta(params);
  if (!meta) return "modern_meta_required";
  if (
    meta["io.modelcontextprotocol/protocolVersion"] !== MODERN_PROTOCOL_VERSION
  ) {
    return "unsupported_protocol_version";
  }
  if (!isRecord(meta["io.modelcontextprotocol/clientCapabilities"])) {
    return "client_capabilities_required";
  }
  return undefined;
}

function serverInfo() {
  return { name: SERVER_NAME, version: SERVER_VERSION };
}

function modernResponseMeta() {
  return {
    "io.modelcontextprotocol/serverInfo": serverInfo(),
  };
}

function modernDiscoveryResult() {
  return {
    supportedVersions: [MODERN_PROTOCOL_VERSION],
    capabilities: { tools: {} },
    instructions:
      "ORBIT exposes read-only command discovery and authorization previews. Execution remains inside the canonical governed runtime.",
    _meta: {
      "io.modelcontextprotocol/serverInfo": serverInfo(),
    },
  };
}

async function handle(request: RpcRequest): Promise<void> {
  if (request.jsonrpc !== "2.0") {
    write(request.id, undefined, { code: -32600, message: "invalid_jsonrpc" });
    return;
  }

  if (request.method === "server/discover") {
    write(request.id, modernDiscoveryResult());
    return;
  }

  if (request.method === "initialize") {
    const params = request.params ?? {};
    const requestedVersion = stringParam(params, "protocolVersion");
    const selectedVersion = HANDSHAKE_PROTOCOL_VERSIONS.includes(
      requestedVersion as (typeof HANDSHAKE_PROTOCOL_VERSIONS)[number],
    )
      ? requestedVersion
      : LATEST_HANDSHAKE_PROTOCOL_VERSION;

    legacyInitialized = true;
    write(request.id, {
      protocolVersion: selectedVersion,
      serverInfo: serverInfo(),
      capabilities: { tools: {} },
      instructions:
        "ORBIT exposes read-only command discovery and authorization previews. Execution remains inside the canonical governed runtime.",
    });
    return;
  }

  if (request.method === "notifications/initialized") return;

  if (request.method === "tools/list") {
    const params = request.params ?? {};
    if (isModernRequest(params)) {
      const modernError = assertModernRequest(params);
      if (modernError) {
          write(request.id, undefined, {
          code: -32602,
          message: modernError,
        });
        return;
      }
    } else if (!legacyInitialized) {
      write(request.id, undefined, {
        code: -32602,
        message: "initialize_required",
      });
      return;
    }

    const modern = isModernRequest(params);
    write(request.id, {
      ...(modern ? { _meta: modernResponseMeta() } : {}),
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
    if (isModernRequest(params)) {
      const modernError = assertModernRequest(params);
      if (modernError) {
          write(request.id, undefined, {
          code: -32602,
          message: modernError,
        });
        return;
      }
    } else if (!legacyInitialized) {
      write(request.id, undefined, {
        code: -32602,
        message: "initialize_required",
      });
      return;
    }

    const name = stringParam(params, "name");
    const args = isRecord(params.arguments) ? params.arguments : {};

    if (name === "orbit.commands.list") {
      write(request.id, {
        ...(isModernRequest(params) ? { _meta: modernResponseMeta() } : {}),
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
        ...(isModernRequest(params) ? { _meta: modernResponseMeta() } : {}),
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
