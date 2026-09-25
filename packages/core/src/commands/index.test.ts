import { describe, expect, it } from "vitest";
import { CommandRegistry } from "./index.js";

describe("CommandRegistry", () => {
  it("exposes a stable command catalog", () => {
    const registry = new CommandRegistry();
    const ids = registry.list().map((command) => command.id);
    expect(ids).toContain("campaign.plan");
    expect(ids).toContain("workflow.simulate");
    expect(ids).toContain("execution.replay");
  });

  it("rejects externally visible mutable commands without approval", () => {
    expect(
      () =>
        new CommandRegistry([
          {
            id: "unsafe.test",
            title: "Unsafe test",
            description: "fixture",
            risk: "high",
            scopes: ["task:execute"],
            surfaces: ["desktop"],
            mutatesState: true,
            externallyVisible: true,
            requiresApproval: false,
          },
        ]),
    ).toThrow("command_approval_contract_violation");
  });

  it("requires the full declared scope set", () => {
    const registry = new CommandRegistry();
    expect(
      registry.decide(
        {
          commandId: "campaign.plan",
          workspaceId: "ws-1",
          actorId: "user-1",
          grantedScopes: ["campaign:write"],
          approvalGranted: false,
        },
        "desktop",
      ),
    ).toEqual({ allowed: false, reason: "scope_denied" });
  });

  it("requires an identified actor", () => {
    const registry = new CommandRegistry();
    expect(
      registry.decide(
        {
          commandId: "analytics.explain",
          workspaceId: "ws-1",
          actorId: " ",
          grantedScopes: ["analytics:read"],
          approvalGranted: false,
        },
        "desktop",
      ),
    ).toEqual({ allowed: false, reason: "actor_required" });
  });

  it("blocks externally visible commands until approval", () => {
    const registry = new CommandRegistry();
    const invocation = {
      commandId: "task.execute",
      workspaceId: "ws-1",
      actorId: "user-1",
      grantedScopes: ["task:execute"],
      approvalGranted: false,
    };

    expect(registry.decide(invocation, "desktop")).toEqual({
      allowed: false,
      reason: "approval_required",
    });

    expect(
      registry.decide({ ...invocation, approvalGranted: true }, "desktop"),
    ).toEqual({ allowed: true, reason: "approved" });
  });
});
