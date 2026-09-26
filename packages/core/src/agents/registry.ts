import type { AgentDefinition, AgentToolGrant } from "./index.js";

const MAX_AGENT_STEPS = 10_000;

export interface AgentValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export function validateAgentDefinition(
  agent: AgentDefinition,
): AgentValidationResult {
  const errors: string[] = [];

  if (!agent.id.trim()) errors.push("id_required");
  if (!agent.workspaceId.trim()) errors.push("workspace_required");
  if (!agent.name.trim()) errors.push("name_required");
  if (!agent.goal.trim()) errors.push("goal_required");
  if (
    !Number.isInteger(agent.maxSteps) ||
    agent.maxSteps < 1 ||
    agent.maxSteps > MAX_AGENT_STEPS
  ) {
    errors.push("invalid_max_steps");
  }

  const seenTools = new Set<string>();
  for (const grant of agent.toolGrants) {
    if (!grant.tool.trim()) errors.push("tool_required");
    if (seenTools.has(grant.tool)) errors.push("duplicate_tool_grant");
    seenTools.add(grant.tool);

    const scopes = new Set(grant.scopes);
    if (grant.scopes.length === 0) {
      errors.push("tool_scope_required");
    } else if (scopes.size !== grant.scopes.length) {
      errors.push("duplicate_tool_scope");
    }
    if (grant.scopes.some((scope) => !scope.trim())) {
      errors.push("empty_tool_scope");
    }
  }

  return { valid: errors.length === 0, errors };
}

function cloneGrant(grant: AgentToolGrant): AgentToolGrant {
  return { ...grant, scopes: [...grant.scopes] };
}

function cloneAgent(agent: AgentDefinition): AgentDefinition {
  return {
    ...agent,
    toolGrants: agent.toolGrants.map(cloneGrant),
    knowledgeScope: [...agent.knowledgeScope],
  };
}

/**
 * In-memory registry used by the same governed runtime contracts that back
 * native persistence. It is intentionally free of execution side effects.
 */
export class AgentRegistry {
  private readonly agents = new Map<string, AgentDefinition>();

  public constructor(agents: readonly AgentDefinition[] = []) {
    for (const agent of agents) this.register(agent);
  }

  public register(agent: AgentDefinition): void {
    const validation = validateAgentDefinition(agent);
    if (!validation.valid) {
      throw new Error("invalid_agent:" + validation.errors.join(","));
    }
    if (this.agents.has(agent.id)) {
      throw new Error("agent_duplicate");
    }
    this.agents.set(agent.id, cloneAgent(agent));
  }

  public replace(agent: AgentDefinition): void {
    const validation = validateAgentDefinition(agent);
    if (!validation.valid) {
      throw new Error("invalid_agent:" + validation.errors.join(","));
    }
    this.agents.set(agent.id, cloneAgent(agent));
  }

  public get(agentId: string): AgentDefinition | undefined {
    const agent = this.agents.get(agentId);
    return agent ? cloneAgent(agent) : undefined;
  }

  public list(workspaceId?: string): readonly AgentDefinition[] {
    return [...this.agents.values()]
      .filter(
        (agent) =>
          workspaceId === undefined || agent.workspaceId === workspaceId,
      )
      .map(cloneAgent)
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  public remove(agentId: string): boolean {
    return this.agents.delete(agentId);
  }
}