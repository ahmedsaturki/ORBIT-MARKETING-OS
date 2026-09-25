import {
  authorizeAgentAction,
  type AgentActionDecision,
  type AgentActionRequest,
  type AgentDefinition,
  type AgentRun,
} from "../agents/index.js";
import {
  evaluatePolicy,
  type MarketingExecutionPolicy,
  type PolicyDecision,
  type PolicyEvaluationInput,
} from "../policies/index.js";

export type ControlPlaneNextState =
  | "execute"
  | "awaiting_approval"
  | "blocked";

export interface ControlPlaneRequest {
  readonly agent: AgentDefinition;
  readonly run: AgentRun;
  readonly agentAction: AgentActionRequest;
  readonly policy: MarketingExecutionPolicy;
  readonly policyInput: PolicyEvaluationInput;
  readonly approvalGranted: boolean;
}

export interface ControlPlaneDecision {
  readonly allowed: boolean;
  readonly nextState: ControlPlaneNextState;
  readonly agentDecision: AgentActionDecision;
  readonly policyDecision: PolicyDecision;
  readonly reasons: readonly string[];
}

function isApprovalRequired(
  agentDecision: AgentActionDecision,
  policyDecision: PolicyDecision,
): boolean {
  return (
    (!agentDecision.allowed && agentDecision.reason === "approval_required") ||
    (!policyDecision.allowed && policyDecision.reason === "approval_required")
  );
}

export function evaluateControlPlaneRequest(
  request: ControlPlaneRequest,
): ControlPlaneDecision {
  const agentDecision = authorizeAgentAction(
    request.agent,
    request.run,
    request.agentAction,
    request.approvalGranted,
  );

  const policyWorkspaceMatches =
    request.policy.workspaceId === request.run.workspaceId;
  const policyDecision = policyWorkspaceMatches
    ? evaluatePolicy(request.policy, request.policyInput)
    : ({
        allowed: false,
        reason: "action_not_allowed",
      } satisfies PolicyDecision);

  const reasons: string[] = [];
  if (!agentDecision.allowed) reasons.push("agent:" + agentDecision.reason);
  if (!policyWorkspaceMatches) reasons.push("policy:workspace_mismatch");
  if (!policyDecision.allowed) reasons.push("policy:" + policyDecision.reason);

  const allowed = agentDecision.allowed && policyDecision.allowed;

  return {
    allowed,
    nextState: allowed
      ? "execute"
      : isApprovalRequired(agentDecision, policyDecision)
        ? "awaiting_approval"
        : "blocked",
    agentDecision,
    policyDecision,
    reasons,
  };
}

export interface ControlPlaneSimulation {
  readonly workspaceId: string;
  readonly decisions: readonly ControlPlaneDecision[];
  readonly executable: boolean;
  readonly approvalRequired: number;
  readonly blocked: number;
}

export function simulateControlPlane(
  requests: readonly ControlPlaneRequest[],
): ControlPlaneSimulation {
  if (requests.length === 0) {
    throw new Error("control_plane_requires_requests");
  }

  const first = requests[0];
  if (!first) throw new Error("control_plane_requires_requests");

  const workspaceId = first.run.workspaceId;
  if (
    requests.some(
      (request) =>
        request.run.workspaceId !== workspaceId ||
        request.agent.workspaceId !== workspaceId ||
        request.policy.workspaceId !== workspaceId,
    )
  ) {
    throw new Error("control_plane_workspace_mismatch");
  }

  const decisions = requests.map(evaluateControlPlaneRequest);

  return {
    workspaceId,
    decisions,
    executable: decisions.every((decision) => decision.allowed),
    approvalRequired: decisions.filter(
      (decision) => decision.nextState === "awaiting_approval",
    ).length,
    blocked: decisions.filter((decision) => decision.nextState === "blocked")
      .length,
  };
}
