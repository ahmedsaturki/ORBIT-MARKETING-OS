import { describe, expect, it } from "vitest";
import { CommandRegistry } from "./index.js";
import {
  listCommandsForSurface,
  previewCommandInvocation,
} from "./surfaces.js";

describe("command operator surfaces", () => {
  it("projects only commands explicitly exposed to CLI and MCP", () => {
    const registry = new CommandRegistry();
    for (const surface of ["cli", "mcp"] as const) {
      const commands = listCommandsForSurface(surface, registry);
      expect(commands.length).toBeGreaterThan(0);
      expect(
        commands.every((command) => command.surfaces.includes(surface)),
      ).toBe(true);
    }
  });

  it("does not turn preview into implicit authorization", () => {
    const preview = previewCommandInvocation({
      commandId: "task.execute",
      workspaceId: "ws-1",
      actorId: "agent-1",
      grantedScopes: ["task:execute"],
      surface: "mcp",
    });
    expect(preview.command.id).toBe("task.execute");
    expect(preview.decision).toEqual({
      allowed: false,
      reason: "approval_required",
    });
  });

  it("uses the canonical registry for unknown commands", () => {
    const preview = previewCommandInvocation({
      commandId: "unknown.command",
      workspaceId: "ws-1",
      actorId: "user-1",
      grantedScopes: [],
      surface: "cli",
    });
    expect(preview.decision).toEqual({
      allowed: false,
      reason: "unknown_command",
    });
  });

  it("preserves scope denial for a known command", () => {
    const preview = previewCommandInvocation({
      commandId: "analytics.explain",
      workspaceId: "ws-1",
      actorId: "user-1",
      grantedScopes: [],
      surface: "cli",
    });
    expect(preview.decision).toEqual({
      allowed: false,
      reason: "scope_denied",
    });
  });
});
