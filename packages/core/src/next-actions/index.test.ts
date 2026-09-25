import { describe, expect, it } from "vitest";
import { deriveNextActions } from "./index.js";

describe("Mission Control next-action engine", () => {
  it("ranks intervention and approval work ahead of lower urgency items", () => {
    const actions = deriveNextActions({
      workspaceId: "ws-1",
      now: "2026-09-25T20:00:00Z",
      interventions: [{ id: "i-1", title: "Reconnect LinkedIn" }],
      approvals: [{ id: "a-1", title: "Approve campaign" }],
      failedWork: [{ id: "f-1", title: "Retry content publish" }],
      followUps: [{ id: "fu-1", title: "Follow up with lead" }],
    });

    expect(actions.map((item) => item.kind)).toEqual([
      "human_intervention",
      "approval",
      "failed_work",
      "follow_up",
    ]);
    expect(actions[0]).toMatchObject({
      priority: "urgent",
      score: 1000,
      sourceId: "i-1",
    });
  });

  it("is deterministic for ties", () => {
    const actions = deriveNextActions({
      workspaceId: "ws-1",
      now: "2026-09-25T20:00:00Z",
      overdueWork: [
        { id: "b", title: "B" },
        { id: "a", title: "A" },
      ],
    });

    expect(actions.map((item) => item.id)).toEqual([
      "overdue_work:a",
      "overdue_work:b",
    ]);
  });

  it("rejects an invalid Mission Control context", () => {
    expect(() =>
      deriveNextActions({
        workspaceId: "",
        now: "2026-09-25T20:00:00Z",
      }),
    ).toThrow("mission_control_workspace_required");

    expect(() =>
      deriveNextActions({
        workspaceId: "ws-1",
        now: "not-a-date",
      }),
    ).toThrow("mission_control_invalid_timestamp");
  });

  it("never emits candidates for malformed source items", () => {
    expect(
      deriveNextActions({
        workspaceId: "ws-1",
        now: "2026-09-25T20:00:00Z",
        blockedWork: [
          { id: "", title: "missing id" },
          { id: "valid", title: "" },
          { id: "ok", title: "Repair queue" },
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        id: "blocked_work:ok",
        sourceId: "ok",
      }),
    ]);
  });
});
