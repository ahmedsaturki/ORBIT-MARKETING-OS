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

const mcp = spawnSync(
  command,
  ["exec", "tsx", "scripts/orbit-mcp.ts"],
  {
    encoding: "utf8",
    env,
    input:
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {},
      }) +
      "\n" +
      JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      }) +
      "\n" +
      JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
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
        },
      }) +
      "\n",
  },
);
if (mcp.status !== 0) {
  process.stderr.write(mcp.stderr || mcp.stdout);
  process.exit(mcp.status ?? 1);
}

const mcpLines = mcp.stdout
  .trim()
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line));

const initialize = mcpLines.find((entry) => entry.id === 1);
const tools = mcpLines.find((entry) => entry.id === 2);
const call = mcpLines.find((entry) => entry.id === 3);

if (
  initialize?.result?.serverInfo?.name !== "orbit-governed-surface" ||
  initialize?.result?.capabilities?.tools === undefined
) {
  throw new Error("orbit_mcp_initialize_smoke_failed");
}

if (
  !Array.isArray(tools?.result?.tools) ||
  tools.result.tools.length < 2 ||
  !tools.result.tools.some((tool) => tool.name === "orbit.command.preview")
) {
  throw new Error("orbit_mcp_tools_list_smoke_failed");
}

const callText = call?.result?.content?.[0]?.text;
const callPayload = typeof callText === "string" ? JSON.parse(callText) : null;
if (
  callPayload?.decision?.allowed !== false ||
  callPayload?.decision?.reason !== "approval_required" ||
  call?.result?.isError !== true
) {
  throw new Error("orbit_mcp_governance_smoke_failed");
}

console.log("orbit_cli_mcp_surface_smoke=PASS");
