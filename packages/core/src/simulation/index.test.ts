import { describe, expect, it } from "vitest";
import { simulateGovernedExecution } from "./index.js";

const request = {
  agent: {
    id: "agent-1",
    workspaceId: "ws-1",
    name: "Operator",
    role: "operator" as const,
    goal: "Operate safely",
    autonomy: "execute_bounded" as const,
    toolGrants: [
      {
        tool: "publisher",
        scopes: ["content.publish"],
        requiresApproval: false,
      },
    ],
    knowledgeScope: ["brand"],
    maxSteps: 5,
    enabled: true,
  },
  run: {
    id: "run-1",
    agentId: "agent-1",
    workspaceId: "ws-1",
    input: "publish approved content",
    status: "running" as const,
    stepCount: 0,
  },
  action: {
    action: "publish",
    scope: "content.publish",
    externallyVisible: true,
    requiresApproval: false,
  },
  policy: {
    id: "policy-1",
    workspaceId: "ws-1",
    name: "bounded",
    mode: "bounded" as const,
    allowedActions: ["publish"],
    blockedActions: [],
    maxDailyExternalActions: 10,
    requireApprovalFor: ["critical"] as const,
  },
  risk: "low" as const,
  dailyExternalActions: 0,
  approvalGranted: false,
};

describe("execution simulation", () => {
  it("does not dispatch and reports the governed result", () => {
    const result = simulateGovernedExecution([
      { id: "publish-1", request },
      {
        id: "publish-2",
        request: {
          ...request,
          dailyExternalActions: 10,
        },
      },
    ]);

    expect(result).toMatchObject({
      workspaceId: "ws-1",
      allowedCount: 1,
      blockedCount: 1,
      executable: false,
    });
    expect(result.steps[0].decision.allowed).toBe(true);
    expect(result.steps[1].decision.block).toBe("budget");
  });

  it("rejects mixed-workspace simulations", () => {
    expect(() =>
      simulateGovernedExecution([
        { id: "a", request },
        {
          id: "b",
          request: {
            ...request,
            run: { ...request.run, workspaceId: "ws-2" },
          },
        },
      ]),
    ).toThrow("simulation_workspace_mismatch");
  });

  it("rejects an empty simulation", () => {
    expect(() => simulateGovernedExecution([])).toThrow(
      "simulation_requires_actions",
    );
  });
});
