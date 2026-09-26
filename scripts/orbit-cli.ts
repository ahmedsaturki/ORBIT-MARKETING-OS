#!/usr/bin/env tsx

import {
  CommandRegistry,
  listCommandsForSurface,
  previewCommandInvocation,
  type CommandSurface,
} from "../packages/core/src/index.ts";

function fail(message: string): never {
  process.stderr.write(message + "\n");
  process.exit(2);
}

function flag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function csv(value: string | undefined): string[] {
  return value ? value.split(",").map((entry) => entry.trim()).filter(Boolean) : [];
}

function output(value: unknown): void {
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");
}

const [group, action, ...rest] = process.argv.slice(2);
const registry = new CommandRegistry();
const supportedSurfaces: readonly CommandSurface[] = [
  "desktop",
  "web",
  "mobile",
  "cli",
  "mcp",
  "agent",
];

if (group === "commands" && action === "list") {
  const surface = (flag(rest, "--surface") ?? "cli") as CommandSurface;
  if (!supportedSurfaces.includes(surface)) fail("invalid_surface");

  output({ surface, commands: listCommandsForSurface(surface, registry) });
  process.exit(0);
}

if (group === "commands" && action === "get") {
  const commandId = rest[0]?.trim();
  if (!commandId) fail("command_id_required");

  const command = registry.get(commandId);
  if (!command) fail("unknown_command");

  output(command);
  process.exit(0);
}

if (group === "command" && action === "preview") {
  const commandId = rest[0]?.trim();
  if (!commandId) fail("command_id_required");

  const surface = (flag(rest, "--surface") ?? "cli") as CommandSurface;
  if (!supportedSurfaces.includes(surface)) fail("invalid_surface");

  output(
    previewCommandInvocation({
      commandId,
      workspaceId: flag(rest, "--workspace") ?? "local",
      actorId: flag(rest, "--actor") ?? "cli-user",
      grantedScopes: csv(flag(rest, "--scopes")),
      approvalGranted: flag(rest, "--approved") === "true",
      surface,
      registry,
    }),
  );
  process.exit(0);
}

output({
  usage: [
    "pnpm orbit commands list [--surface cli|mcp|agent|desktop|web|mobile]",
    "pnpm orbit commands get <commandId>",
    "pnpm orbit command preview <commandId> --workspace <id> --actor <id> --scopes <scope1,scope2> [--approved true]",
  ],
  note: "Preview is read-only. Execution remains inside the canonical governed runtime.",
});
