import { describe, expect, it } from "vitest";
import type { Task } from "../src/types/index.js";
import { FixtureConnector } from "../src/connectors/fixture.js";
import { ConnectorRegistry } from "../src/connectors/registry.js";
import { assertSupportedTask } from "../src/connectors/contracts.js";

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: "task-1",
  workspaceId: "ws-1",
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
  ...overrides,
});

describe("connector registry", () => {
  it("registers and requires a connector by platform", () => {
    const registry = new ConnectorRegistry();
    const connector = new FixtureConnector({ platform: "facebook" });
    registry.register(connector);
    expect(registry.require("facebook")).toBe(connector);
    expect(registry.get("instagram")).toBeUndefined();
  });

  it("rejects duplicate platform registration", () => {
    const registry = new ConnectorRegistry();
    registry.register(new FixtureConnector({ platform: "facebook" }));
    expect(() => registry.register(new FixtureConnector({ platform: "facebook" }))).toThrow(
      "Connector already registered",
    );
  });
});

describe("connector capability boundary", () => {
  it("rejects task/platform mismatches", () => {
    const connector = new FixtureConnector({ platform: "facebook" });
    expect(() =>
      assertSupportedTask(connector, makeTask({ platform: "instagram" })),
    ).toThrow("Task platform does not match");
  });

  it("stops on a platform challenge", async () => {
    const connector = new FixtureConnector({
      platform: "facebook",
      challengeOnExecute: true,
    });
    const result = await connector.execute(makeTask(), {
      accountId: "account-1",
      userConfirmed: true,
    });
    expect(result).toMatchObject({
      status: "blocked",
      reason: "platform_challenge",
    });
  });

  it("requires explicit confirmation before execution", async () => {
    const connector = new FixtureConnector({ platform: "facebook" });
    const resultPromise = connector.execute(makeTask(), {
      accountId: "account-1",
      userConfirmed: false,
    });
    await expect(resultPromise).rejects.toThrow("Explicit user confirmation");
  });
});
