import { describe, expect, it } from "vitest";
import { replayExecutionTrace, validateReplayTrace } from "./index.js";

const base = {
  workspaceId: "ws-1",
  taskId: "task-1",
};

const event = (
  sequence: number,
  kind:
    | "decision"
    | "dispatch"
    | "result"
    | "state_transition"
    | "human_intervention",
  outcome: "allowed" | "blocked" | "success" | "failure" | "waiting",
  state?:
    | "created"
    | "running"
    | "awaiting_approval"
    | "awaiting_user_action"
    | "succeeded"
    | "failed"
    | "cancelled",
) => ({
  ...base,
  sequence,
  at: "2026-09-25T20:00:00Z",
  kind,
  outcome,
  ...(state ? { state } : {}),
});

describe("execution replay kernel", () => {
  it("reconstructs lifecycle state without re-executing the action", () => {
    const trace = [
      event(0, "decision", "allowed", "created"),
      event(1, "dispatch", "allowed", "running"),
      event(2, "result", "success", "succeeded"),
    ];

    expect(replayExecutionTrace(trace)).toEqual({
      workspaceId: "ws-1",
      taskId: "task-1",
      lifecycleState: "succeeded",
      eventCount: 3,
      successfulActions: 1,
      failedActions: 0,
      waiting: false,
    });
  });

  it("models human intervention as a resumable waiting state", () => {
    const trace = [
      event(0, "decision", "allowed", "created"),
      event(1, "human_intervention", "waiting", "awaiting_user_action"),
    ];

    expect(replayExecutionTrace(trace).waiting).toBe(true);
    expect(replayExecutionTrace(trace).lifecycleState).toBe(
      "awaiting_user_action",
    );
  });

  it("rejects sequence gaps and cross-task mixing", () => {
    expect(
      validateReplayTrace([
        event(0, "decision", "allowed", "created"),
        event(2, "result", "success", "succeeded"),
      ]),
    ).toEqual({ valid: false, reason: "replay_sequence_gap" });

    expect(
      validateReplayTrace([
        event(0, "decision", "allowed", "created"),
        {
          ...event(1, "result", "success", "succeeded"),
          taskId: "task-2",
        },
      ]),
    ).toEqual({ valid: false, reason: "replay_identity_mismatch" });
  });

  it("rejects events after a terminal state", () => {
    expect(
      validateReplayTrace([
        event(0, "decision", "allowed", "created"),
        event(1, "result", "success", "succeeded"),
        event(2, "state_transition", "success", "running"),
      ]),
    ).toEqual({ valid: false, reason: "replay_event_after_terminal" });
  });
});
