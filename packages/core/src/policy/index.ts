import type { CircuitState, PolicyContext, PolicyDecision } from "../types/index.js";

/**
 * Deterministic policy evaluation. Order matters: hard stops first,
 * then budgets, then human-in-the-loop gates. Fail closed on unknown states.
 */
export function evaluatePolicy(ctx: PolicyContext): PolicyDecision {
  if (ctx.accountStatus === "restricted") {
    return { allowed: false, reason: "account_restricted" };
  }
  if (ctx.accountStatus === "paused") {
    return { allowed: false, reason: "account_paused" };
  }
  if (ctx.challengeActive) {
    return { allowed: false, reason: "challenge_active" };
  }
  if (ctx.breakerOpen) {
    return { allowed: false, reason: "circuit_open" };
  }
  if (ctx.dailyActionsDone >= ctx.dailyLimit) {
    return { allowed: false, reason: "daily_limit" };
  }
  if (!ctx.approvalAllowed) {
    return { allowed: false, reason: "approval_required" };
  }
  return { allowed: true, reason: "allowed" };
}

export interface CircuitBreakerConfig {
  readonly maxConsecutiveErrors: number;
  readonly pauseDurationMs: number;
  readonly halfOpenAfterMs: number;
}

export const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  maxConsecutiveErrors: 3,
  pauseDurationMs: 45 * 60 * 1000,
  halfOpenAfterMs: 60 * 1000,
};

export interface CircuitBreakerSnapshot {
  readonly state: CircuitState;
  readonly consecutiveErrors: number;
  readonly openedAt?: string;
}

export function createCircuitBreaker(
  config: CircuitBreakerConfig = DEFAULT_CIRCUIT_CONFIG,
): CircuitBreakerSnapshot {
  return { state: "closed", consecutiveErrors: 0 };
}

export function recordCircuitSuccess(snapshot: CircuitBreakerSnapshot): CircuitBreakerSnapshot {
  return { state: "closed", consecutiveErrors: 0 };
}

export function recordCircuitFailure(
  snapshot: CircuitBreakerSnapshot,
  config: CircuitBreakerConfig = DEFAULT_CIRCUIT_CONFIG,
  now: string,
): CircuitBreakerSnapshot {
  const consecutiveErrors = snapshot.consecutiveErrors + 1;
  if (snapshot.state === "open") {
    return { ...snapshot, consecutiveErrors };
  }
  if (consecutiveErrors >= config.maxConsecutiveErrors) {
    return { state: "open", consecutiveErrors, openedAt: now };
  }
  return { state: snapshot.state, consecutiveErrors };
}

export function maybeHalfOpen(
  snapshot: CircuitBreakerSnapshot,
  config: CircuitBreakerConfig = DEFAULT_CIRCUIT_CONFIG,
  nowMs: number,
): CircuitBreakerSnapshot {
  if (snapshot.state !== "open" || !snapshot.openedAt) return snapshot;
  const openedMs = Date.parse(snapshot.openedAt);
  if (Number.isNaN(openedMs)) return snapshot;
  if (nowMs - openedMs >= config.pauseDurationMs) {
    return { state: "half_open", consecutiveErrors: 0 };
  }
  return snapshot;
}

export function isCircuitBlocking(snapshot: CircuitBreakerSnapshot): boolean {
  return snapshot.state === "open";
}
