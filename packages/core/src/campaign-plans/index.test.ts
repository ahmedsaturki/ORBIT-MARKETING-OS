import { describe, expect, it } from "vitest";
import { compileCampaignExecutionPlan } from "./index.js";

const strategy = {
  id: "strategy-1",
  workspaceId: "ws-1",
  version: 1,
  objectiveIds: ["objective-1"],
  audienceIds: ["audience-1"],
  offerIds: ["offer-1"],
  positioning: "Clear value",
  keyMessages: ["Message"],
  contentPillars: ["Pillar"],
  channels: ["linkedin", "telegram"],
  status: "active" as const,
  createdAt: "2026-09-25T00:00:00Z",
  updatedAt: "2026-09-25T00:00:00Z",
};

describe("campaign plan compiler", () => {
  it("compiles strategy into an ordered governed workflow", () => {
    const plan = compileCampaignExecutionPlan({
      workspaceId: "ws-1",
      campaignId: "campaign-1",
      campaignName: "Launch",
      strategy,
    });

    expect(plan.steps.map((step) => step.kind)).toEqual([
      "strategy_alignment",
      "audience_review",
      "content_brief",
      "content_creation",
      "approval",
      "execution",
      "engagement",
      "outcome_review",
      "learning",
    ]);
    expect(plan.steps[4]).toMatchObject({
      id: "campaign-1:approval",
      requiresApproval: true,
    });
    expect(plan.steps[5].dependsOn).toEqual(["campaign-1:approval"]);
  });

  it("rejects strategy from another workspace", () => {
    expect(() =>
      compileCampaignExecutionPlan({
        workspaceId: "ws-2",
        campaignId: "campaign-1",
        campaignName: "Launch",
        strategy,
      }),
    ).toThrow("campaign_plan_workspace_mismatch");
  });

  it("rejects incomplete strategy", () => {
    expect(() =>
      compileCampaignExecutionPlan({
        workspaceId: "ws-1",
        campaignId: "campaign-1",
        campaignName: "Launch",
        strategy: { ...strategy, audienceIds: [] },
      }),
    ).toThrow("campaign_plan_invalid_strategy");
  });

  it("rejects missing campaign identity", () => {
    expect(() =>
      compileCampaignExecutionPlan({
        workspaceId: "ws-1",
        campaignId: "",
        campaignName: "Launch",
        strategy,
      }),
    ).toThrow("campaign_plan_identity_required");
  });
});
