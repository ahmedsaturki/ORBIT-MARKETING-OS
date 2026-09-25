import { describe, expect, it } from "vitest";
import {
  assertSupportedTask,
  assertUserConfirmed,
  ConnectorRegistry,
  FixtureConnector,
} from "../src/connectors/index.js";
import type { Task } from "../src/types/index.js";

const task: Task = {
  id: "task-1",
  workspaceId: "workspace-1",
  campaignId: "campaign-1",
  accountId: "account-1",
  platform: "facebook",
  kind: "publish",
  priority: 1,
  status: "pending",
  attempts: 0,
  maxAttempts: 3,
  availableAt: "2026-09-24T00:00:00.000Z",
  idempotencyKey: "task-1",
  createdAt: "2026-09-24T00:00:00.000Z",
};

describe("connector authorization boundary", () => {
  it("rejects externally-visible actions without explicit confirmation", () => {
    expect(() =>
      assertUserConfirmed({
        accountId: "acc-1",
        userConfirmed: false,
      }),
    ).toThrow("Explicit user confirmation is required");
  });

  it("accepts an explicitly confirmed action", () => {
    expect(() =>
      assertUserConfirmed({
        accountId: "acc-1",
        userConfirmed: true,
      }),
    ).not.toThrow();
  });

  it("rejects a task for the wrong platform", () => {
    const connector = new FixtureConnector({ platform: "facebook" });
    expect(() =>
      assertSupportedTask(connector, { ...task, platform: "instagram" }),
    ).toThrow("Task platform does not match connector platform");
  });

  it("rejects a task kind not exposed by a connector", () => {
    const connector = new FixtureConnector({
      platform: "facebook",
      capabilities: { publish: false },
    });
    expect(() => assertSupportedTask(connector, task)).toThrow(
      "Connector does not support task kind: publish",
    );
  });

  it("rejects duplicate platform registrations", () => {
    const registry = new ConnectorRegistry();
    registry.register(new FixtureConnector({ platform: "facebook" }));
    expect(() =>
      registry.register(new FixtureConnector({ platform: "facebook" })),
    ).toThrow("Connector already registered");
  });

  it("returns a typed missing-connector failure from require", () => {
    const registry = new ConnectorRegistry();
    expect(() => registry.require("facebook")).toThrow(
      "No connector registered for platform: facebook",
    );
  });
});
