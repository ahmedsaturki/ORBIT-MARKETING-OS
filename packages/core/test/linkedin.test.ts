import { describe, expect, it } from "vitest";
import { LinkedInConnector } from "../src/connectors/linkedin.js";
import type { Task } from "../src/types/index.js";

const task: Task = {
  id: "task-linkedin-1",
  workspaceId: "workspace-1",
  campaignId: "campaign-1",
  accountId: "account-1",
  platform: "linkedin",
  kind: "publish",
  contentId: "content-1",
  destinationId: "member",
  priority: 1,
  status: "pending",
  attempts: 0,
  maxAttempts: 3,
  availableAt: "2026-09-24T00:00:00.000Z",
  idempotencyKey: "linkedin-1",
  createdAt: "2026-09-24T00:00:00.000Z",
};

const context = { accountId: "account-1", userConfirmed: true };

describe("LinkedInConnector", () => {
  it("does not require unrelated OIDC userinfo scopes to connect", async () => {
    const calls: string[] = [];
    const connector = new LinkedInConnector({
      apiVersion: "202609",
      tokenResolver: async () => "token-secret",
      authorResolver: async () => "urn:li:person:123",
      contentResolver: async () => "Hello",
      fetchImpl: async (input) => {
        calls.push(String(input));
        return new Response("", { status: 500 });
      },
    });

    await expect(connector.connect(context)).resolves.toEqual({
      status: "succeeded",
      message: "LinkedIn authorization material is available locally.",
    });
    expect(calls).toEqual([]);
  });

  it("publishes through the Posts API with the configured version", async () => {
    let request: Request | undefined;
    const connector = new LinkedInConnector({
      apiVersion: "202609",
      tokenResolver: async () => "token-secret",
      authorResolver: async () => "urn:li:person:123",
      contentResolver: async () => "Hello LinkedIn",
      fetchImpl: async (input, init) => {
        request = new Request(input, init);
        return new Response("", {
          status: 201,
          headers: { "x-restli-id": "urn:li:share:456" },
        });
      },
    });

    await expect(connector.execute(task, context)).resolves.toMatchObject({
      status: "succeeded",
      externalId: "urn:li:share:456",
    });

    expect(request?.url).toBe("https://api.linkedin.com/rest/posts");
    expect(request?.headers.get("authorization")).toBe("Bearer token-secret");
    expect(request?.headers.get("linkedin-version")).toBe("202609");
    expect(request?.headers.get("x-restli-protocol-version")).toBe("2.0.0");
    const body = await request?.json();
    expect(body).toMatchObject({
      author: "urn:li:person:123",
      commentary: "Hello LinkedIn",
      lifecycleState: "PUBLISHED",
    });
  });

  it("requires explicit confirmation before external execution", async () => {
    const connector = new LinkedInConnector({
      apiVersion: "202609",
      tokenResolver: async () => "token-secret",
      authorResolver: async () => "urn:li:person:123",
      contentResolver: async () => "Hello",
    });

    await expect(
      connector.execute(task, { accountId: "account-1", userConfirmed: false }),
    ).rejects.toThrow("Explicit user confirmation");
  });

  it("maps authorization, rate-limit and server errors separately", async () => {
    const make = (status: number) =>
      new LinkedInConnector({
        apiVersion: "202609",
        tokenResolver: async () => "token-secret",
        authorResolver: async () => "urn:li:person:123",
        contentResolver: async () => "Hello",
        fetchImpl: async () => new Response("", { status }),
      });

    await expect(make(401).execute(task, context)).resolves.toMatchObject({
      status: "blocked",
      reason: "authorization_required",
    });
    await expect(make(429).execute(task, context)).resolves.toMatchObject({
      status: "blocked",
      reason: "platform_limit",
    });
    await expect(make(500).execute(task, context)).resolves.toMatchObject({
      status: "failed",
    });
  });

  it("treats network failures as unknown delivery status", async () => {
    const connector = new LinkedInConnector({
      apiVersion: "202609",
      tokenResolver: async () => "token-secret",
      authorResolver: async () => "urn:li:person:123",
      contentResolver: async () => "Hello",
      fetchImpl: async () => {
        throw new Error("network down");
      },
    });

    await expect(connector.execute(task, context)).resolves.toMatchObject({
      status: "blocked",
      reason: "delivery_status_unknown",
    });
  });

  it("rejects unsafe API configuration", () => {
    expect(
      () =>
        new LinkedInConnector({
          apiVersion: "202609",
          apiBaseUrl: "http://example.com",
          tokenResolver: async () => "token",
          authorResolver: async () => "urn:li:person:123",
          contentResolver: async () => "Hello",
        }),
    ).toThrow("HTTPS");

    expect(
      () =>
        new LinkedInConnector({
          apiVersion: "20260",
          tokenResolver: async () => "token",
          authorResolver: async () => "urn:li:person:123",
          contentResolver: async () => "Hello",
        }),
    ).toThrow("YYYYMM");
  });
});
