export type ActionRisk = "low" | "medium" | "high" | "critical";
export type AutonomyMode = "manual" | "assisted" | "bounded" | "approved";

export interface ExecutionPolicy {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly mode: AutonomyMode;
  readonly allowedActions: readonly string[];
  readonly blockedActions: readonly string[];
  readonly maxDailyExternalActions: number;
  readonly requireApprovalFor: readonly ActionRisk[];
}

export interface PolicyEvaluationInput {
  readonly action: string;
  readonly risk: ActionRisk;
  readonly externallyVisible: boolean;
  readonly dailyExternalActions: number;
  readonly approvalGranted: boolean;
}

export type PolicyDecision =
  | {
      readonly allowed: true;
      readonly reason: "manual" | "bounded" | "approved";
    }
  | {
      readonly allowed: false;
      readonly reason:
        | "blocked_action"
        | "action_not_allowed"
        | "daily_budget_exceeded"
        | "approval_required";
    };

export function evaluatePolicy(
  policy: ExecutionPolicy,
  input: PolicyEvaluationInput,
): PolicyDecision {
  if (policy.blockedActions.includes(input.action)) {
    return { allowed: false, reason: "blocked_action" };
  }

  if (!policy.allowedActions.includes(input.action)) {
    return { allowed: false, reason: "action_not_allowed" };
  }

  if (
    input.externallyVisible &&
    input.dailyExternalActions >= policy.maxDailyExternalActions
  ) {
    return { allowed: false, reason: "daily_budget_exceeded" };
  }

  const approvalRequired =
    input.risk === "critical" ||
    policy.requireApprovalFor.includes(input.risk) ||
    policy.mode === "approved";

  if (approvalRequired && !input.approvalGranted) {
    return { allowed: false, reason: "approval_required" };
  }

  if (policy.mode === "manual") return { allowed: true, reason: "manual" };
  if (approvalRequired) return { allowed: true, reason: "approved" };
  return { allowed: true, reason: "bounded" };
}
