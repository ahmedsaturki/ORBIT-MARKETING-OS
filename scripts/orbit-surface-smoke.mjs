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

console.log("orbit_surface_smoke=PASS");
