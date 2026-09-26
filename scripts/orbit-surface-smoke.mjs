import { spawnSync } from "node:child_process";

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const env = { ...process.env, CI: "1" };

const list = spawnSync(
  command,
  ["exec", "tsx", "scripts/orbit-cli.ts", "commands", "list", "--surface", "mcp"],
  { encoding: "utf8", env },
);
if (list.status !== 0) {
  process.stderr.write(list.stderr || list.stdout);
  process.exit(list.status ?? 1);
}

const listed = JSON.parse(list.stdout);
if (
  listed.surface !== "mcp" ||
  !Array.isArray(listed.commands) ||
  listed.commands.length === 0
) {
  throw new Error("orbit_mcp_surface_smoke_failed");
}

const preview = spawnSync(
  command,
  [
    "exec",
    "tsx",
    "scripts/orbit-cli.ts",
    "command",
    "preview",
    "task.execute",
    "--workspace",
    "smoke",
    "--actor",
    "smoke-agent",
    "--scopes",
    "task:execute",
  ],
  { encoding: "utf8", env },
);
if (preview.status !== 0) {
  process.stderr.write(preview.stderr || preview.stdout);
  process.exit(preview.status ?? 1);
}

const previewed = JSON.parse(preview.stdout);
if (
  previewed.decision?.allowed !== false ||
  previewed.decision?.reason !== "approval_required"
) {
  throw new Error("orbit_preview_governance_smoke_failed");
}

function runMcp(input) {
  const result = spawnSync(
    command,
    ["exec", "tsx", "scripts/orbit-mcp.ts"],
    { encoding: "utf8", env, input: input.trim() + "\n" },
  );
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }
  return result.stdout
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

const legacyLines = runMcp(
  JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "orbit-smoke", version: "1.0.0" },
    },
  }) +
    "\n" +
    JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    }),
);

const initialize = legacyLines.find((entry) => entry.id === 1);
const legacyTools = legacyLines.find((entry) => entry.id === 2);

if (
  initialize?.result?.protocolVersion !== "2025-11-25" ||
  initialize?.result?.serverInfo?.name !== "orbit-governed-surface" ||
  initialize?.result?.capabilities?.tools === undefined
) {
  throw new Error("orbit_mcp_initialize_smoke_failed");
}

if (
  !Array.isArray(legacyTools?.result?.tools) ||
  !legacyTools.result.tools.some(
    (tool) => tool.name === "orbit.command.preview",
  )
) {
  throw new Error("orbit_mcp_legacy_tools_smoke_failed");
}

const invalidModernLines = runMcp(
  JSON.stringify({
    jsonrpc: "2.0",
    id: 99,
    method: "tools/list",
    params: {},
  }),
);
const invalidModern = invalidModernLines.find((entry) => entry.id === 99);
if (
  invalidModern?.error?.code !== -32602 ||
  invalidModern?.error?.message !== "initialize_required"
) {
  throw new Error("orbit_mcp_preinit_guard_smoke_failed");
}

const modernLines = runMcp(
  JSON.stringify({
    jsonrpc: "2.0",
    id: 3,
    method: "server/discover",
    params: {},
  }) +
    "\n" +
    JSON.stringify({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/list",
      params: {
        _meta: {
          "io.modelcontextprotocol/protocolVersion": "2026-07-28",
          "io.modelcontextprotocol/clientCapabilities": {},
          "io.modelcontextprotocol/clientInfo": {
            name: "orbit-smoke",
            version: "1.0.0",
          },
        },
      },
    }) +
    "\n" +
    JSON.stringify({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "orbit.command.preview",
        arguments: {
          commandId: "task.execute",
          workspaceId: "smoke",
          actorId: "smoke-agent",
          grantedScopes: ["task:execute"],
          approvalGranted: false,
        },
        _meta: {
          "io.modelcontextprotocol/protocolVersion": "2026-07-28",
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
);

const discovery = modernLines.find((entry) => entry.id === 3);
const modernTools = modernLines.find((entry) => entry.id === 4);
const call = modernLines.find((entry) => entry.id === 5);

if (
  discovery?.result?.supportedVersions?.includes("2026-07-28") !== true ||
  discovery?.result?._meta?.[
    "io.modelcontextprotocol/serverInfo"
  ]?.name !== "orbit-governed-surface"
) {
  throw new Error("orbit_mcp_discovery_smoke_failed");
}

if (
  modernTools?.result?._meta?.["io.modelcontextprotocol/serverInfo"]?.name !==
    "orbit-governed-surface" ||
  !Array.isArray(modernTools?.result?.tools) ||
  !modernTools.result.tools.some(
    (tool) => tool.name === "orbit.command.preview",
  )
) {
  throw new Error("orbit_mcp_modern_tools_smoke_failed");
}

const callText = call?.result?.content?.[0]?.text;
const callPayload = typeof callText === "string" ? JSON.parse(callText) : null;
if (
  call?.result?._meta?.["io.modelcontextprotocol/serverInfo"]?.name !==
    "orbit-governed-surface" ||
  callPayload?.decision?.allowed !== false ||
  callPayload?.decision?.reason !== "approval_required" ||
  call?.result?.isError !== true
) {
  throw new Error("orbit_mcp_governance_smoke_failed");
}

console.log("orbit_cli_mcp_surface_smoke=PASS");
