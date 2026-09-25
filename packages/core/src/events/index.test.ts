import { describe, expect, it } from "vitest";
import { OperationalEventLog, createOperationalEvent } from "./index.js";

describe("OperationalEventLog", () => {
  it("assigns contiguous sequences and preserves append order", () => {
    const log = new OperationalEventLog("ws-1");
    const first = log.append({
      workspaceId: "ws-1",
      timestamp: "2026-09-26T00:00:00Z",
      kind: "command.received",
      outcome: "started",
      actor: "user",
      entityType: "campaign",
      entityId: "cmp-1",
    });
    const second = log.append({
      workspaceId: "ws-1",
      timestamp: "2026-09-26T00:00:01Z",
      kind: "command.completed",
      outcome: "succeeded",
      actor: "system",
      parentEventId: first.id,
    });

    expect([first.sequence, second.sequence]).toEqual([1, 2]);
    expect(log.list()).toHaveLength(2);
    expect(log.forEntity("campaign", "cmp-1")).toHaveLength(1);
  });

  it("fails closed for cross-workspace and broken parent references", () => {
    const log = new OperationalEventLog("ws-1");
    expect(() =>
      log.append({
        workspaceId: "ws-2",
        timestamp: "2026-09-26T00:00:00Z",
        kind: "command.received",
        outcome: "started",
        actor: "user",
      }),
    ).toThrow("operational_event_workspace_mismatch");

    expect(() =>
      log.append({
        workspaceId: "ws-1",
        timestamp: "2026-09-26T00:00:00Z",
        kind: "command.received",
        outcome: "started",
        actor: "user",
        parentEventId: "missing",
      }),
    ).toThrow("operational_event_parent_missing");
  });

  it("redacts sensitive payload keys before trace storage", () => {
    const event = createOperationalEvent({
      workspaceId: "ws-1",
      timestamp: "2026-09-26T00:00:00Z",
      kind: "connector.result",
      outcome: "succeeded",
      actor: "connector",
      payload: { accessToken: "secret-value", result: "ok" },
    });

    expect(event.payload).toEqual({ accessToken: "[REDACTED]", result: "ok" });
  });

  it("returns defensive deep copies", () => {
    const log = new OperationalEventLog("ws-1");
    const appended = log.append({
      workspaceId: "ws-1",
      timestamp: "2026-09-26T00:00:00Z",
      kind: "work.created",
      outcome: "started",
      actor: "system",
      payload: { nested: { labels: ["a"] } },
    });

    const snapshot = log.list() as OperationalEvent[];
    const nested = snapshot[0]?.payload as { nested: { labels: string[] } };
    nested.nested.labels.push("mutated");

    expect(appended.payload).toEqual({ nested: { labels: ["a"] } });
    expect(log.list()[0]?.payload).toEqual({ nested: { labels: ["a"] } });
  });
});
