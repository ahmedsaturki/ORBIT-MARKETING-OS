import {
  authorizeAgentAction,
  type AgentActionRequest,
  type AgentDefinition,
  type AgentRun,
} from "../agents/index.js";
import {
  evaluatePolicy,
  type MarketingExecutionPolicy,
  type PolicyEvaluationInput,
} from "../policies/index.js";

export type ExecutionDecisionBlock =
  "agent" | "policy" | "approval" | "budget" | "invalid_request";

export interface GovernedExecutionRequest {
  readonly agent: AgentDefinition;
  readonly run: AgentRun;
  readonly action: AgentActionRequest;
  readonly policy: MarketingExecutionPolicy;
  readonly risk: PolicyEvaluationInput["risk"];
  readonly dailyExternalActions: number;
  readonly approvalGranted: boolean;
}

export interface GovernedExecutionDecision {
  readonly allowed: boolean;
  readonly block?: ExecutionDecisionBlock;
  readonly reason: string;
}

export function evaluateGovernedExecution(
  request: GovernedExecutionRequest,
): GovernedExecutionDecision {
  if (request.run.status !== "running") {
    return {
      allowed: false,
      block: "invalid_request",
      reason: "agent_run_not_running",
    };
  }

  if (request.policy.workspaceId !== request.run.workspaceId) {
    return {
      allowed: false,
      block: "invalid_request",
      reason: "policy_workspace_mismatch",
    };
  }

  const agentDecision = authorizeAgentAction(
    request.agent,
    request.run,
    request.action,
    request.approvalGranted,
  );
  if (!agentDecision.allowed) {
    const block: ExecutionDecisionBlock =
      agentDecision.reason === "approval_required" ? "approval" : "agent";
    return {
      allowed: false,
      block,
      reason: `agent_${agentDecision.reason}`,
    };
  }

  const policyDecision = evaluatePolicy(request.policy, {
    action: request.action.action,
    risk: request.risk,
    externallyVisible: request.action.externallyVisible,
    dailyExternalActions: request.dailyExternalActions,
    approvalGranted: request.approvalGranted,
  });

  if (!policyDecision.allowed) {
    let block: ExecutionDecisionBlock = "policy";
    if (policyDecision.reason === "daily_budget_exceeded") block = "budget";
    if (policyDecision.reason === "approval_required") block = "approval";
    return {
      allowed: false,
      block,
      reason: `policy_${policyDecision.reason}`,
    };
  }

  return {
    allowed: true,
    reason: request.approvalGranted
      ? "governed_and_approved"
      : "governed_bounded",
  };
}
