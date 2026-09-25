import { describe, expect, it } from "vitest";
import {
  evaluateControlPlaneRequest,
  simulateControlPlane,
} from "./index.js";

const agent = {
  id: "agent-1",
  workspaceId: "ws-1",
  name: "Campaign Operator",
  role: "campaign" as const,
  goal: "Execute approved campaign work",
  autonomy: "execute_with_approval" as const,
  toolGrants: [
    {
      tool: "publisher",
      scopes: ["content.publish"],
      requiresApproval: false,
    },
  ],
  knowledgeScope: ["brand"],
  maxSteps: 10,
  enabled: true,
};

const run = {
  id: "run-1",
  agentId: "agent-1",
  workspaceId: "ws-1",
  input: "publish campaign",
  status: "running" as const,
  stepCount: 0,
};

const policy = {
  id: "policy-1",
  workspaceId: "ws-1",
  name: "Conservative",
  mode: "approved" as const,
  allowedActions: ["content.publish"],
  blockedActions: [],
  maxDailyExternalActions: 10,
  requireApprovalFor: ["high" as const],
};

const request = {
  agent,
  run,
  agentAction: {
    action: "publish",
    scope: "content.publish",
    externallyVisible: true,
    requiresApproval: false,
  },
  policy,
  policyInput: {
    action: "content.publish",
    risk: "high" as const,
    externallyVisible: true,
    dailyExternalActions: 0,
    approvalGranted: false,
  },
  approvalGranted: false,
};

describe("control plane", () => {
  it("blocks execution behind the approval boundary", () => {
    const decision = evaluateControlPlaneRequest(request);

    expect(decision.allowed).toBe(false);
    expect(decision.nextState).toBe("awaiting_approval");
    expect(decision.reasons).toContain("policy:approval_required");
  });

  it("executes only when agent and policy both allow the action", () => {
    const decision = evaluateControlPlaneRequest({
      ...request,
      approvalGranted: true,
      policyInput: {
        ...request.policyInput,
        approvalGranted: true,
      },
    });

    expect(decision.allowed).toBe(true);
    expect(decision.nextState).toBe("execute");
    expect(decision.reasons).toEqual([]);
  });

  it("rejects actions outside the granted agent scope", () => {
    const decision = evaluateControlPlaneRequest({
      ...request,
      agentAction: {
        ...request.agentAction,
        scope: "connector.delete",
      },
      policyInput: {
        ...request.policyInput,
        approvalGranted: true,
      },
      approvalGranted: true,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.nextState).toBe("blocked");
    expect(decision.reasons).toContain("agent:scope_denied");
  });

  it("rejects a mixed-workspace simulation before execution planning", () => {
    expect(() =>
      simulateControlPlane([
        request,
        {
          ...request,
          run: { ...request.run, workspaceId: "ws-2" },
        },
      ]),
    ).toThrow("control_plane_workspace_mismatch");
  });

  it("reports aggregate approval and blocked counts deterministically", () => {
    const simulation = simulateControlPlane([
      request,
      {
        ...request,
        agentAction: {
          ...request.agentAction,
          scope: "connector.delete",
        },
        policyInput: {
          ...request.policyInput,
          approvalGranted: true,
        },
        approvalGranted: true,
      },
    ]);

    expect(simulation.executable).toBe(false);
    expect(simulation.approvalRequired).toBe(1);
    expect(simulation.blocked).toBe(1);
  });
});
