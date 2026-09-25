export type ReplayEventKind =
  | "decision"
  | "dispatch"
  | "result"
  | "state_transition"
  | "human_intervention";

export type ReplayLifecycleState =
  | "created"
  | "running"
  | "awaiting_approval"
  | "awaiting_user_action"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface ReplayEvent {
  readonly sequence: number;
  readonly at: string;
  readonly workspaceId: string;
  readonly taskId: string;
  readonly kind: ReplayEventKind;
  readonly outcome: "allowed" | "blocked" | "success" | "failure" | "waiting";
  readonly state?: ReplayLifecycleState;
  readonly reason?: string;
}

export interface ExecutionReplay {
  readonly workspaceId: string;
  readonly taskId: string;
  readonly lifecycleState: ReplayLifecycleState;
  readonly eventCount: number;
  readonly successfulActions: number;
  readonly failedActions: number;
  readonly waiting: boolean;
}

const TERMINAL_STATES = new Set<ReplayLifecycleState>([
  "succeeded",
  "failed",
  "cancelled",
]);

function assertReplayEvent(event: ReplayEvent): void {
  if (!Number.isInteger(event.sequence) || event.sequence < 0) {
    throw new Error("replay_invalid_sequence");
  }
  if (!event.at.trim() || Number.isNaN(Date.parse(event.at))) {
    throw new Error("replay_invalid_timestamp");
  }
  if (!event.workspaceId.trim() || !event.taskId.trim()) {
    throw new Error("replay_missing_identity");
  }
}

export function validateReplayTrace(events: readonly ReplayEvent[]): {
  readonly valid: boolean;
  readonly reason?: string;
} {
  if (events.length === 0) return { valid: false, reason: "replay_empty" };

  const first = events[0];
  if (!first) return { valid: false, reason: "replay_empty" };

  try {
    events.forEach(assertReplayEvent);
  } catch (error) {
    return {
      valid: false,
      reason: error instanceof Error ? error.message : "replay_invalid_event",
    };
  }

  if (first.sequence !== 0) {
    return { valid: false, reason: "replay_sequence_must_start_at_zero" };
  }

  for (let index = 1; index < events.length; index += 1) {
    const previous = events[index - 1];
    const current = events[index];
    if (!previous || !current) {
      return { valid: false, reason: "replay_invalid_event" };
    }
    if (current.sequence !== previous.sequence + 1) {
      return { valid: false, reason: "replay_sequence_gap" };
    }
    if (
      current.workspaceId !== first.workspaceId ||
      current.taskId !== first.taskId
    ) {
      return { valid: false, reason: "replay_identity_mismatch" };
    }
    if (TERMINAL_STATES.has(previous.state ?? "created")) {
      return { valid: false, reason: "replay_event_after_terminal" };
    }
  }

  return { valid: true };
}

/**
 * Reconstructs the observable execution state without re-running external
 * actions. This is intentionally a read-only interpretation of an audit trace.
 */
export function replayExecutionTrace(
  events: readonly ReplayEvent[],
): ExecutionReplay {
  const validation = validateReplayTrace(events);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  const first = events[0];
  if (!first) {
    throw new Error("replay_empty");
  }

  let lifecycleState: ReplayLifecycleState = "created";
  let successfulActions = 0;
  let failedActions = 0;

  for (const event of events) {
    if (event.state) lifecycleState = event.state;
    if (event.kind === "result" && event.outcome === "success") {
      successfulActions += 1;
    }
    if (event.kind === "result" && event.outcome === "failure") {
      failedActions += 1;
    }
    if (event.kind === "human_intervention") {
      lifecycleState = "awaiting_user_action";
    }
  }

  return {
    workspaceId: first.workspaceId,
    taskId: first.taskId,
    lifecycleState,
    eventCount: events.length,
    successfulActions,
    failedActions,
    waiting:
      lifecycleState === "awaiting_user_action" ||
      lifecycleState === "awaiting_approval",
  };
}
