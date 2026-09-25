import { validateStrategy, type StrategyDocument } from "../strategy/index.js";

export type CampaignPlanStepKind =
  | "strategy_alignment"
  | "audience_review"
  | "content_brief"
  | "content_creation"
  | "approval"
  | "execution"
  | "engagement"
  | "outcome_review"
  | "learning";

export interface CampaignPlanStep {
  readonly id: string;
  readonly kind: CampaignPlanStepKind;
  readonly title: string;
  readonly dependsOn: readonly string[];
  readonly externallyVisible: boolean;
  readonly requiresApproval: boolean;
}

export interface CampaignExecutionPlan {
  readonly workspaceId: string;
  readonly campaignId: string;
  readonly strategyId: string;
  readonly steps: readonly CampaignPlanStep[];
}

export interface CampaignPlanInput {
  readonly workspaceId: string;
  readonly campaignId: string;
  readonly campaignName: string;
  readonly strategy: StrategyDocument;
}

/**
 * Compiles a valid strategy into a deterministic campaign workflow skeleton.
 * The compiler produces work definitions only; it does not create database rows
 * or execute connectors.
 */
export function compileCampaignExecutionPlan(
  input: CampaignPlanInput,
): CampaignExecutionPlan {
  if (!input.workspaceId.trim() || !input.campaignId.trim()) {
    throw new Error("campaign_plan_identity_required");
  }
  if (input.strategy.workspaceId !== input.workspaceId) {
    throw new Error("campaign_plan_workspace_mismatch");
  }
  if (!input.campaignName.trim()) {
    throw new Error("campaign_plan_name_required");
  }

  const validation = validateStrategy(input.strategy);
  if (!validation.valid) {
    throw new Error("campaign_plan_invalid_strategy");
  }

  const prefix = input.campaignId;
  const steps: readonly CampaignPlanStep[] = [
    {
      id: prefix + ":strategy",
      kind: "strategy_alignment",
      title: "Align campaign with strategy",
      dependsOn: [],
      externallyVisible: false,
      requiresApproval: false,
    },
    {
      id: prefix + ":audience",
      kind: "audience_review",
      title: "Review campaign audience",
      dependsOn: [prefix + ":strategy"],
      externallyVisible: false,
      requiresApproval: false,
    },
    {
      id: prefix + ":brief",
      kind: "content_brief",
      title: "Prepare content brief",
      dependsOn: [prefix + ":audience"],
      externallyVisible: false,
      requiresApproval: false,
    },
    {
      id: prefix + ":content",
      kind: "content_creation",
      title: "Create channel-native content variants",
      dependsOn: [prefix + ":brief"],
      externallyVisible: false,
      requiresApproval: false,
    },
    {
      id: prefix + ":approval",
      kind: "approval",
      title: "Approve campaign content",
      dependsOn: [prefix + ":content"],
      externallyVisible: true,
      requiresApproval: true,
    },
    {
      id: prefix + ":execution",
      kind: "execution",
      title: "Execute approved campaign actions",
      dependsOn: [prefix + ":approval"],
      externallyVisible: true,
      requiresApproval: true,
    },
    {
      id: prefix + ":engagement",
      kind: "engagement",
      title: "Monitor and route engagement",
      dependsOn: [prefix + ":execution"],
      externallyVisible: true,
      requiresApproval: false,
    },
    {
      id: prefix + ":outcome",
      kind: "outcome_review",
      title: "Review opportunities and outcomes",
      dependsOn: [prefix + ":engagement"],
      externallyVisible: false,
      requiresApproval: false,
    },
    {
      id: prefix + ":learning",
      kind: "learning",
      title: "Capture evidence-backed learning",
      dependsOn: [prefix + ":outcome"],
      externallyVisible: false,
      requiresApproval: false,
    },
  ];

  return {
    workspaceId: input.workspaceId,
    campaignId: input.campaignId,
    strategyId: input.strategy.id,
    steps,
  };
}
