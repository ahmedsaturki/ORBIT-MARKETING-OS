export interface ExecutionPolicy {
  readonly dailyLimit: number;
  readonly maxConsecutiveFailures: number;
  readonly requireExplicitConfirmation: boolean;
}

export interface ExecutionState {
  readonly dayKey: string;
  readonly completedToday: number;
  readonly consecutiveFailures: number;
  readonly blocked: boolean;
}

export type ExecutionDecision =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly reason:
        "daily_limit" | "circuit_breaker" | "confirmation_required" | "blocked";
    };

/**
 * Decide whether an externally-visible task may be started.
 *
 * This is a safety guardrail: it never tries to bypass platform controls
 * or conceal automation.
 */
export function canStartExecution(
  policy: ExecutionPolicy,
  state: ExecutionState,
  confirmedByUser: boolean,
): ExecutionDecision {
  if (state.blocked) return { allowed: false, reason: "blocked" };
  if (state.consecutiveFailures >= policy.maxConsecutiveFailures) {
    return { allowed: false, reason: "circuit_breaker" };
  }
  if (state.completedToday >= policy.dailyLimit) {
    return { allowed: false, reason: "daily_limit" };
  }
  if (policy.requireExplicitConfirmation && !confirmedByUser) {
    return { allowed: false, reason: "confirmation_required" };
  }
  return { allowed: true };
}

export function recordExecutionSuccess(
  state: ExecutionState,
  dayKey: string,
): ExecutionState {
  return {
    dayKey,
    completedToday: state.dayKey === dayKey ? state.completedToday + 1 : 1,
    consecutiveFailures: 0,
    blocked: false,
  };
}

export function recordExecutionFailure(
  state: ExecutionState,
  dayKey: string,
): ExecutionState {
  return {
    dayKey,
    completedToday: state.dayKey === dayKey ? state.completedToday : 0,
    consecutiveFailures:
      state.dayKey === dayKey ? state.consecutiveFailures + 1 : 1,
    blocked: false,
  };
}
