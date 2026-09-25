export type MarketingRunStage =
  | "strategy"
  | "campaign"
  | "content"
  | "approval"
  | "execution"
  | "engagement"
  | "conversion"
  | "measurement"
  | "learning";

export type MarketingRunStatus =
  | "draft"
  | "ready"
  | "running"
  | "awaiting_approval"
  | "awaiting_user_action"
  | "blocked"
  | "completed"
  | "failed"
  | "cancelled";

export type MarketingRunStepState =
  | "pending"
  | "ready"
  | "running"
  | "awaiting_approval"
  | "awaiting_user_action"
  | "blocked"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface MarketingRunContext {
  readonly workspaceId: string;
  readonly strategyId?: string;
  readonly objectiveId?: string;
  readonly audienceId?: string;
  readonly offerId?: string;
  readonly campaignId?: string;
  readonly knowledgeIds?: readonly string[];
}

export interface MarketingRunStep {
  readonly id: string;
  readonly stage: MarketingRunStage;
  readonly title: string;
  readonly state: MarketingRunStepState;
  readonly dependsOn: readonly string[];
  readonly externallyVisible: boolean;
  readonly requiresApproval: boolean;
  readonly risk: "low" | "medium" | "high" | "critical";
  readonly attempt: number;
  readonly resultRef?: string;
}

export interface MarketingRun {
  readonly id: string;
  readonly context: MarketingRunContext;
  readonly status: MarketingRunStatus;
  readonly steps: readonly MarketingRunStep[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MarketingRunBlueprintInput {
  readonly id: string;
  readonly now: string;
  readonly context: MarketingRunContext;
  readonly includeStages?: readonly MarketingRunStage[];
}

const CANONICAL_STAGES: readonly MarketingRunStage[] = [
  "strategy",
  "campaign",
  "content",
  "approval",
  "execution",
  "engagement",
  "conversion",
  "measurement",
  "learning",
];

const RISK_BY_STAGE: Readonly<Record<MarketingRunStage, MarketingRunStep["risk"]>> = {
  strategy: "low",
  campaign: "low",
  content: "medium",
  approval: "high",
  execution: "high",
  engagement: "high",
  conversion: "high",
  measurement: "low",
  learning: "low",
};

const EXTERNAL_BY_STAGE: Readonly<Record<MarketingRunStage, boolean>> = {
  strategy: false,
  campaign: false,
  content: false,
  approval: false,
  execution: true,
  engagement: true,
  conversion: true,
  measurement: false,
  learning: false,
};

function assertContext(context: MarketingRunContext): void {
  if (!context.workspaceId.trim()) throw new Error("marketing_run_workspace_required");
}

function assertTimestamp(now: string): void {
  if (!now.trim() || Number.isNaN(Date.parse(now))) {
    throw new Error("marketing_run_invalid_timestamp");
  }
}

function stepId(runId: string, stage: MarketingRunStage): string {
  return runId + ":" + stage;
}

function stateRank(state: MarketingRunStepState): number {
  switch (state) {
    case "succeeded":
      return 3;
    case "cancelled":
      return 2;
    case "failed":
    case "blocked":
    case "awaiting_user_action":
    case "awaiting_approval":
    case "running":
      return 1;
    default:
      return 0;
  }
}

export function buildMarketingRunBlueprint(
  input: MarketingRunBlueprintInput,
): MarketingRun {
  assertContext(input.context);
  assertTimestamp(input.now);

  const stages = input.includeStages
    ? [...input.includeStages]
    : [...CANONICAL_STAGES];

  const uniqueStages = [...new Set(stages)];
  const invalidStage = uniqueStages.find((stage) => !CANONICAL_STAGES.includes(stage));
  if (invalidStage) throw new Error("marketing_run_invalid_stage:" + invalidStage);
  if (uniqueStages.length === 0) throw new Error("marketing_run_stage_required");

  let previousId: string | undefined;
  const steps: MarketingRunStep[] = uniqueStages.map((stage) => {
    const id = stepId(input.id, stage);
    const requiresApproval =
      stage === "approval" ||
      (EXTERNAL_BY_STAGE[stage] && RISK_BY_STAGE[stage] !== "low");

    const step: MarketingRunStep = {
      id,
      stage,
      title: stage.replace(/\b\w/g, (letter) => letter.toUpperCase()),
      state: previousId ? "pending" : "ready",
      dependsOn: previousId ? [previousId] : [],
      externallyVisible: EXTERNAL_BY_STAGE[stage],
      requiresApproval,
      risk: RISK_BY_STAGE[stage],
      attempt: 0,
    };
    previousId = id;
    return step;
  });

  return {
    id: input.id,
    context: input.context,
    status: steps[0]?.state === "ready" ? "ready" : "draft",
    steps,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

export function getRunnableRunSteps(
  run: MarketingRun,
): readonly MarketingRunStep[] {
  return run.steps.filter((step) => {
    if (step.state !== "ready") return false;
    return step.dependsOn.every((dependencyId) => {
      const dependency = run.steps.find((candidate) => candidate.id === dependencyId);
      return dependency?.state === "succeeded";
    });
  });
}

export function summarizeMarketingRun(run: MarketingRun): {
  readonly total: number;
  readonly succeeded: number;
  readonly waiting: number;
  readonly blocked: number;
  readonly failed: number;
  readonly ready: number;
} {
  return {
    total: run.steps.length,
    succeeded: run.steps.filter((step) => step.state === "succeeded").length,
    waiting: run.steps.filter(
      (step) =>
        step.state === "awaiting_approval" ||
        step.state === "awaiting_user_action" ||
      step.state === "running",
    ).length,
    blocked: run.steps.filter((step) => step.state === "blocked").length,
    failed: run.steps.filter((step) => step.state === "failed").length,
    ready: getRunnableRunSteps(run).length,
  };
}

export function deriveMarketingRunStatus(run: MarketingRun): MarketingRunStatus {
  if (run.steps.length === 0) return "draft";

  const summary = summarizeMarketingRun(run);

  if (summary.succeeded === summary.total) return "completed";
  if (summary.failed > 0) return "failed";
  if (summary.blocked > 0) return "blocked";
  if (
    run.steps.some(
      (step) =>
        step.state === "awaiting_user_action" ||
        step.state === "awaiting_approval",
    )
  ) {
    return run.steps.some((step) => step.state === "awaiting_user_action")
      ? "awaiting_user_action"
      : "awaiting_approval";
  }
  if (run.steps.some((step) => step.state === "running")) return "running";
  if (summary.ready > 0) return "ready";
  return "draft";
}

export function updateMarketingRunStep(
  run: MarketingRun,
  stepIdValue: string,
  nextState: MarketingRunStepState,
  updatedAt: string,
  resultRef?: string,
): MarketingRun {
  assertTimestamp(updatedAt);

  const target = run.steps.find((step) => step.id === stepIdValue);
  if (!target) throw new Error("marketing_run_step_not_found");

  if (stateRank(nextState) < stateRank(target.state) && target.state === "succeeded") {
    throw new Error("marketing_run_terminal_step");
  }

  if (
    nextState === "running" &&
    target.dependsOn.some(
      (dependencyId) =>
        run.steps.find((step) => step.id === dependencyId)?.state !== "succeeded",
    )
  ) {
    throw new Error("marketing_run_dependencies_not_satisfied");
  }

  const steps = run.steps.map((step) =>
    step.id === stepIdValue
      ? {
          ...step,
          state: nextState,
          attempt:
            nextState === "running" ? step.attempt + 1 : step.attempt,
          ...(resultRef !== undefined ? { resultRef } : {}),
        }
      : step,
  );

  const nextRun = {
    ...run,
    steps,
    status: run.status,
    updatedAt,
  };

  const derived = deriveMarketingRunStatus(nextRun);
  return { ...nextRun, status: derived };
}

export const MARKETING_RUN_CANONICAL_STAGES = CANONICAL_STAGES;
