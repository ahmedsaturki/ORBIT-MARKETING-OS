export type AgentRole =
  | "research"
  | "strategy"
  | "content"
  | "engagement"
  | "crm"
  | "analytics"
  | "campaign"
  | "qa"
  | "operator";

export type AgentRunStatus =
  | "queued"
  | "running"
  | "awaiting_approval"
  | "awaiting_user_action"
  | "succeeded"
  | "failed"
  | "cancelled";

export type AgentAutonomy =
  | "suggest"
  | "draft"
  | "execute_bounded"
  | "execute_with_approval";

export interface AgentToolGrant {
  readonly tool: string;
  readonly scopes: readonly string[];
  readonly requiresApproval: boolean;
}

export interface AgentDefinition {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly role: AgentRole;
  readonly goal: string;
  readonly autonomy: AgentAutonomy;
  readonly toolGrants: readonly AgentToolGrant[];
  readonly knowledgeScope: readonly string[];
  readonly maxSteps: number;
  readonly enabled: boolean;
}

export interface AgentRun {
  readonly id: string;
  readonly agentId: string;
  readonly workspaceId: string;
  readonly input: string;
  readonly status: AgentRunStatus;
  readonly stepCount: number;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly blockedReason?: string;
}

export interface AgentActionRequest {
  readonly action: string;
  readonly scope: string;
  readonly externallyVisible: boolean;
  readonly requiresApproval: boolean;
}

export type AgentActionDecision =
  | {
      readonly allowed: true;
      readonly reason: "bounded_autonomy" | "approved";
    }
  | {
      readonly allowed: false;
      readonly reason:
        | "disabled"
        | "step_limit"
        | "scope_denied"
        | "approval_required";
    };

export function authorizeAgentAction(
  agent: AgentDefinition,
  run: AgentRun,
  request: AgentActionRequest,
  approved: boolean,
): AgentActionDecision {
  if (!agent.enabled) return { allowed: false, reason: "disabled" };
  if (run.stepCount >= agent.maxSteps)
    return { allowed: false, reason: "step_limit" };

  const scopeAllowed = agent.toolGrants.some((grant) =>
    grant.scopes.includes(request.scope),
  );
  if (!scopeAllowed) return { allowed: false, reason: "scope_denied" };

  if (request.requiresApproval && !approved) {
    return { allowed: false, reason: "approval_required" };
  }

  if (request.externallyVisible && agent.autonomy === "suggest") {
    return { allowed: false, reason: "approval_required" };
  }

  return {
    allowed: true,
    reason: approved ? "approved" : "bounded_autonomy",
  };
}
