import { describe, expect, it } from "vitest";
import { evaluateGovernedExecution } from "./decision.js";

const baseRequest = {
  agent: {
    id: "agent-1",
    workspaceId: "ws-1",
    name: "Campaign Operator",
    role: "campaign" as const,
    goal: "Run bounded campaigns",
    autonomy: "execute_bounded" as const,
    toolGrants: [
      {
        tool: "publisher",
        scopes: ["campaign.publish"],
        requiresApproval: false,
      },
    ],
    knowledgeScope: ["brand"],
    maxSteps: 3,
    enabled: true,
  },
  run: {
    id: "run-1",
    agentId: "agent-1",
    workspaceId: "ws-1",
    input: "publish",
    status: "running" as const,
    stepCount: 1,
  },
  action: {
    action: "publish",
    scope: "campaign.publish",
    externallyVisible: true,
    requiresApproval: false,
  },
  policy: {
    id: "policy-1",
    workspaceId: "ws-1",
    name: "Bounded",
    mode: "bounded" as const,
    allowedActions: ["publish"],
    blockedActions: [],
    maxDailyExternalActions: 10,
    requireApprovalFor: ["critical"] as const,
  },
  risk: "low" as const,
  dailyExternalActions: 2,
  approvalGranted: false,
};

describe("governed execution decision kernel", () => {
  it("allows a bounded action when both agent and policy permit it", () => {
    expect(evaluateGovernedExecution(baseRequest)).toEqual({
      allowed: true,
      reason: "governed_bounded",
    });
  });

  it("blocks a disallowed agent scope before policy execution", () => {
    const result = evaluateGovernedExecution({
      ...baseRequest,
      action: { ...baseRequest.action, scope: "billing.write" },
    });
    expect(result).toEqual({
      allowed: false,
      block: "agent",
      reason: "agent_scope_denied",
    });
  });

  it("rejects policies from another workspace", () => {
    const result = evaluateGovernedExecution({
      ...baseRequest,
      policy: {
        ...baseRequest.policy,
        workspaceId: "ws-2",
      },
    });
    expect(result).toEqual({
      allowed: false,
      block: "invalid_request",
      reason: "policy_workspace_mismatch",
    });
  });

  it("blocks policy approval requirements explicitly", () => {
    const result = evaluateGovernedExecution({
      ...baseRequest,
      risk: "critical",
    });
    expect(result).toEqual({
      allowed: false,
      block: "approval",
      reason: "policy_approval_required",
    });
  });

  it("blocks daily budgets independently of agent permission", () => {
    const result = evaluateGovernedExecution({
      ...baseRequest,
      dailyExternalActions: 10,
    });
    expect(result).toEqual({
      allowed: false,
      block: "budget",
      reason: "policy_daily_budget_exceeded",
    });
  });

  it("rejects non-running agent runs without invoking external policy", () => {
    expect(
      evaluateGovernedExecution({
        ...baseRequest,
        run: { ...baseRequest.run, status: "awaiting_approval" },
      }),
    ).toEqual({
      allowed: false,
      block: "invalid_request",
      reason: "agent_run_not_running",
    });
  });
});
