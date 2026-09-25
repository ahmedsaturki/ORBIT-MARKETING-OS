import { describe, expect, it } from "vitest";
import { authorizeAgentAction } from "./agents/index.js";
import { isUsableKnowledge } from "./knowledge/index.js";
import { evaluatePolicy } from "./policies/index.js";
import { canStartWork } from "./operations/index.js";
import { validateStrategy } from "./strategy/index.js";

describe("ORBIT product foundation", () => {
  it("rejects an empty strategy", () => {
    const result = validateStrategy({
      id: "strategy-1",
      workspaceId: "ws-1",
      version: 1,
      objectiveIds: [],
      audienceIds: [],
      offerIds: [],
      positioning: "",
      keyMessages: [],
      contentPillars: [],
      channels: [],
      status: "draft",
      createdAt: "2026-09-25T00:00:00Z",
      updatedAt: "2026-09-25T00:00:00Z",
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("objective_required");
    expect(result.errors).toContain("positioning_required");
  });

  it("accepts grounded knowledge only when it has a source and trust", () => {
    expect(
      isUsableKnowledge({
        id: "k-1",
        workspaceId: "ws-1",
        statement: "Approved message",
        sourceIds: ["source-1"],
        trust: "approved",
        tags: [],
        createdAt: "2026-09-25T00:00:00Z",
        updatedAt: "2026-09-25T00:00:00Z",
      }),
    ).toBe(true);

    expect(
      isUsableKnowledge({
        id: "k-2",
        workspaceId: "ws-1",
        statement: "Unverified",
        sourceIds: ["source-2"],
        trust: "unverified",
        tags: [],
        createdAt: "2026-09-25T00:00:00Z",
        updatedAt: "2026-09-25T00:00:00Z",
      }),
    ).toBe(false);
  });

  it("enforces policy budgets and approvals before external execution", () => {
    const policy = {
      id: "p-1",
      workspaceId: "ws-1",
      name: "Conservative",
      mode: "bounded" as const,
      allowedActions: ["publish"],
      blockedActions: ["delete_account"],
      maxDailyExternalActions: 10,
      requireApprovalFor: ["high", "critical"] as const,
    };

    expect(
      evaluatePolicy(policy, {
        action: "publish",
        risk: "high",
        externallyVisible: true,
        dailyExternalActions: 2,
        approvalGranted: false,
      }),
    ).toEqual({ allowed: false, reason: "approval_required" });

    expect(
      evaluatePolicy(policy, {
        action: "publish",
        risk: "low",
        externallyVisible: true,
        dailyExternalActions: 10,
        approvalGranted: true,
      }),
    ).toEqual({ allowed: false, reason: "daily_budget_exceeded" });
  });

  it("blocks work that is not ready or has blocking dependencies", () => {
    const item = {
      id: "work-1",
      workspaceId: "ws-1",
      type: "campaign" as const,
      title: "Launch campaign",
      status: "ready" as const,
      priority: 1,
      createdAt: "2026-09-25T00:00:00Z",
      updatedAt: "2026-09-25T00:00:00Z",
    };

    expect(canStartWork(item, [])).toBe(true);
    expect(
      canStartWork(item, [
        {
          workspaceId: "ws-1",
          predecessorId: "work-0",
          successorId: "work-1",
          kind: "blocks",
        },
      ]),
    ).toBe(false);
    expect(canStartWork({ ...item, status: "blocked" }, [])).toBe(false);
  });

  it("enforces agent tool scopes and step limits", () => {
    const agent = {
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
    };
    const run = {
      id: "run-1",
      agentId: "agent-1",
      workspaceId: "ws-1",
      input: "publish",
      status: "running" as const,
      stepCount: 1,
    };

    expect(
      authorizeAgentAction(
        agent,
        run,
        {
          action: "publish",
          scope: "campaign.publish",
          externallyVisible: true,
          requiresApproval: false,
        },
        false,
      ),
    ).toEqual({ allowed: true, reason: "bounded_autonomy" });

    expect(
      authorizeAgentAction(
        { ...agent, autonomy: "execute_with_approval" },
        run,
        {
          action: "publish",
          scope: "campaign.publish",
          externallyVisible: true,
          requiresApproval: false,
        },
        false,
      ),
    ).toEqual({ allowed: false, reason: "approval_required" });

    expect(
      authorizeAgentAction(
        { ...agent, workspaceId: "ws-2" },
        run,
        {
          action: "publish",
          scope: "campaign.publish",
          externallyVisible: true,
          requiresApproval: false,
        },
        true,
      ),
    ).toEqual({ allowed: false, reason: "workspace_mismatch" });

    expect(
      authorizeAgentAction(
        agent,
        { ...run, stepCount: 3 },
        {
          action: "publish",
          scope: "campaign.publish",
          externallyVisible: true,
          requiresApproval: false,
        },
        false,
      ),
    ).toEqual({ allowed: false, reason: "step_limit" });
  });
});
