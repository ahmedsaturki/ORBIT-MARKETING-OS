import { evaluateGovernedExecution, type GovernedExecutionRequest, type GovernedExecutionDecision } from "../execution/decision.js";

export interface SimulationAction {
  readonly id: string;
  readonly request: GovernedExecutionRequest;
}

export interface SimulationStep {
  readonly id: string;
  readonly decision: GovernedExecutionDecision;
}

export interface ExecutionSimulation {
  readonly workspaceId: string;
  readonly steps: readonly SimulationStep[];
  readonly allowedCount: number;
  readonly blockedCount: number;
  readonly executable: boolean;
}

/**
 * Evaluates a batch of governed actions without dispatching anything externally.
 * The simulation is deterministic and does not mutate agent, policy, queue, or
 * connector state.
 */
export function simulateGovernedExecution(
  actions: readonly SimulationAction[],
): ExecutionSimulation {
  if (actions.length === 0) {
    throw new Error("simulation_requires_actions");
  }

  const workspaceId = actions[0].request.run.workspaceId;
  if (actions.some((item) => item.request.run.workspaceId !== workspaceId)) {
    throw new Error("simulation_workspace_mismatch");
  }

  const steps = actions.map((item) => ({
    id: item.id,
    decision: evaluateGovernedExecution(item.request),
  }));
  const allowedCount = steps.filter((step) => step.decision.allowed).length;

  return {
    workspaceId,
    steps,
    allowedCount,
    blockedCount: steps.length - allowedCount,
    executable: allowedCount === steps.length,
  };
}
