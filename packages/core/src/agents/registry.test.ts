import { describe, expect, it } from "vitest";
import {
  AgentRegistry,
  validateAgentDefinition,
} from "./registry.js";
import type { AgentDefinition } from "./index.js";

function agent(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    id: "content-agent",
    workspaceId: "ws-1",
    name: "Content Agent",
    role: "content",
    goal: "Draft approved content.",
    autonomy: "draft",
    toolGrants: [
      {
        tool: "content.draft",
        scopes: ["content:write", "knowledge:read"],
        requiresApproval: false,
      },
    ],
    knowledgeScope: ["brand"],
    maxSteps: 25,
    enabled: true,
    ...overrides,
  };
}

describe("AgentRegistry", () => {
  it("validates bounded tool grants and step budgets", () => {
    expect(validateAgentDefinition(agent()).valid).toBe(true);
    expect(
      validateAgentDefinition(
        agent({
          maxSteps: 0,
          toolGrants: [
            {
              tool: "content.draft",
              scopes: [],
              requiresApproval: false,
            },
          ],
        }),
      ).errors,
    ).toEqual(["invalid_max_steps", "tool_scope_required"]);
  });

  it("rejects duplicate grants and scopes", () => {
    const result = validateAgentDefinition(
      agent({
        toolGrants: [
          {
            tool: "content.draft",
            scopes: ["content:write", "content:write"],
            requiresApproval: false,
          },
          {
            tool: "content.draft",
            scopes: ["knowledge:read"],
            requiresApproval: false,
          },
        ],
      }),
    );
    expect(result.errors).toEqual([
      "duplicate_tool_grant",
      "duplicate_tool_scope",
    ]);
  });

  it("stores defensive copies and scopes listing by workspace", () => {
    const input = agent();
    const registry = new AgentRegistry([input]);
    input.toolGrants[0]!.scopes.push("mutated");
    const stored = registry.get("content-agent");
    expect(stored?.toolGrants[0]?.scopes).toEqual([
      "content:write",
      "knowledge:read",
    ]);

    expect(registry.list("ws-2")).toEqual([]);
    expect(registry.list("ws-1").map((item) => item.id)).toEqual([
      "content-agent",
    ]);
  });

  it("requires unique ids on register and permits explicit replacement", () => {
    const registry = new AgentRegistry([agent()]);
    expect(() => registry.register(agent())).toThrow("agent_duplicate");

    registry.replace(
      agent({
        name: "Replacement",
        maxSteps: 50,
      }),
    );
    expect(registry.get("content-agent")?.name).toBe("Replacement");
    expect(registry.get("content-agent")?.maxSteps).toBe(50);
    expect(registry.remove("content-agent")).toBe(true);
    expect(registry.get("content-agent")).toBeUndefined();
  });
});
