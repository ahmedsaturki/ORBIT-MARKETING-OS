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

describe("Mission Control operational state", () => {
  // Every emitted candidate must be attributable to the workspace whose
  // state produced it.
  it("stamps every candidate with the requesting workspace", () => {
    const actions = deriveNextActions({
      workspaceId: "workspace-1",
      now: "2026-09-26T00:00:00.000Z",
      interventions: [{ id: "t1", title: "Approve publish" }],
      approvals: [{ id: "a1", title: "Review budget" }],
      failedWork: [{ id: "f1", title: "Retry send" }],
    });

    expect(actions).toHaveLength(3);
    for (const action of actions) {
      expect(action.workspaceId).toBe("workspace-1");
    }
  });

  // Two workspaces must never see each other's operational state. Stamping a
  // single workspace is already covered above; what this adds is the contrast,
  // and critically the non-emptiness of both results.
  //
  // An earlier version asserted that the second workspace derived an empty
  // queue. That proved nothing: deriveNextActions only ranks supplied work and
  // does not filter, so an empty result is a property of passing no
  // interventions rather than of workspace isolation.
  it("derives the same work for two workspaces, each stamped with its own", () => {
    const interventions = [{ id: "t1", title: "Approve publish" }];
    const first = deriveNextActions({
      workspaceId: "workspace-1",
      now: "2026-09-26T00:00:00.000Z",
      interventions,
    });
    const second = deriveNextActions({
      workspaceId: "workspace-2",
      now: "2026-09-26T00:00:00.000Z",
      interventions,
    });

    expect(first.length).toBeGreaterThan(0);
    expect(second.length).toBeGreaterThan(0);
    expect(first.map((action) => action.id)).toEqual(
      second.map((action) => action.id),
    );
    expect(second.every((action) => action.workspaceId === "workspace-2")).toBe(
      true,
    );
  });

  it("refuses a blank workspace rather than emitting unattributed actions", () => {
    expect(() =>
      deriveNextActions({
        workspaceId: "   ",
        now: "2026-09-26T00:00:00.000Z",
        interventions: [{ id: "t1", title: "Approve publish" }],
      }),
    ).toThrow("mission_control_workspace_required");
  });

  // The queue is a read-only projection: deriving must not mutate the input.
  it("is read-only and leaves the supplied state untouched", () => {
    const interventions = [{ id: "t1", title: "Approve publish" }];
    const input = {
      workspaceId: "workspace-1",
      now: "2026-09-26T00:00:00.000Z",
      interventions,
    };
    const snapshot = JSON.stringify(input);

    const actions = deriveNextActions(input);
    expect(JSON.stringify(input)).toBe(snapshot);

    // Mutating the result must not reach back into the input either.
    const [firstAction] = actions;
    if (
      firstAction &&
      typeof firstAction === "object" &&
      "title" in firstAction
    ) {
      Object.defineProperty(firstAction, "title", {
        value: "tampered",
        writable: false,
      });
    }
    expect(interventions.at(0)?.title).toBe("Approve publish");
  });

  // The projection carries only id/title per item, so no session or token
  // material can reach the Mission Control surface.
  it("emits no credential or session material", () => {
    const actions = deriveNextActions({
      workspaceId: "workspace-1",
      now: "2026-09-26T00:00:00.000Z",
      interventions: [{ id: "t1", title: "Approve publish" }],
      approvals: [{ id: "a1", title: "Review budget" }],
      failedWork: [{ id: "f1", title: "Retry send" }],
      overdueWork: [{ id: "o1", title: "Chase invoice" }],
      followUps: [{ id: "c1", title: "Call back" }],
      blockedWork: [{ id: "b1", title: "Unblock publish" }],
    });

    const rendered = JSON.stringify(actions);
    for (const forbidden of [
      "session",
      "token",
      "secret",
      "password",
      "cookie",
      "authorization",
    ]) {
      expect(rendered.toLowerCase()).not.toContain(forbidden);
    }

    // Only the declared projection fields may appear on a candidate.
    for (const action of actions) {
      expect(Object.keys(action).sort()).toEqual([
        "id",
        "kind",
        "priority",
        "reason",
        "score",
        "sourceId",
        "title",
        "workspaceId",
      ]);
    }
  });

  // An empty workspace state yields an empty queue, not a fabricated one.
  it("returns an empty queue when there is nothing to do", () => {
    expect(
      deriveNextActions({
        workspaceId: "workspace-1",
        now: "2026-09-26T00:00:00.000Z",
      }),
    ).toEqual([]);
  });
});
