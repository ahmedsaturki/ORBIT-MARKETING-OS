import { describe, expect, it } from "vitest";
import { TelegramConnector } from "../src/connectors/telegram.js";

const task = {
  id: "task-1",
  workspaceId: "workspace-1",
  campaignId: "campaign-1",
  accountId: "account-1",
  platform: "telegram" as const,
  kind: "message" as const,
  contentId: "content-1",
  destinationId: "chat-1",
  priority: 1,
  status: "pending" as const,
  attempts: 0,
  maxAttempts: 3,
  availableAt: "2026-09-24T00:00:00.000Z",
  idempotencyKey: "task-1",
  createdAt: "2026-09-24T00:00:00.000Z",
};

describe("TelegramConnector", () => {
  it("authenticates through getMe", async () => {
    const requests: string[] = [];
    const connector = new TelegramConnector({
      tokenResolver: async () => "token/with spaces",
      contentResolver: async () => "hello",
      apiBaseUrl: "https://telegram.test",
      fetchImpl: async (input) => {
        requests.push(String(input));
        return new Response(
          JSON.stringify({
            ok: true,
            result: { id: 7, is_bot: true, first_name: "OrbitBot" },
          }),
          { status: 200 },
        );
      },
    });

    const result = await connector.connect({
      accountId: "account-1",
      userConfirmed: true,
    });

    expect(result.status).toBe("succeeded");
    expect(requests[0]).toContain("/bottoken%2Fwith%20spaces/getMe");
  });

  it("requires explicit confirmation for external execution", async () => {
    const connector = new TelegramConnector({
      tokenResolver: async () => "token",
      contentResolver: async () => "hello",
      apiBaseUrl: "https://telegram.test",
      fetchImpl: async () => new Response("{}", { status: 200 }),
    });

    const result = await connector.execute(task, {
      accountId: "account-1",
      userConfirmed: false,
    });

    expect(result).toMatchObject({
      status: "blocked",
      reason: "user_confirmation_required",
    });
  });

  it("rejects external execution without a destination", async () => {
    const connector = new TelegramConnector({
      tokenResolver: async () => "token",
      contentResolver: async () => "hello",
      apiBaseUrl: "https://telegram.test",
    });

    const { destinationId: _destinationId, ...taskWithoutDestination } = task;
    const result = await connector.execute(taskWithoutDestination, {
      accountId: "account-1",
      userConfirmed: true,
    });

    expect(result.status).toBe("failed");
  });

  it("blocks authorization failures and rate limits", async () => {
    const authConnector = new TelegramConnector({
      tokenResolver: async () => "token",
      contentResolver: async () => "hello",
      apiBaseUrl: "https://telegram.test",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            ok: false,
            error_code: 401,
            description: "Unauthorized",
          }),
          { status: 401 },
        ),
    });

    await expect(
      authConnector.connect({ accountId: "account-1", userConfirmed: true }),
    ).resolves.toMatchObject({
      status: "blocked",
      reason: "authorization_required",
    });

    const limitedConnector = new TelegramConnector({
      tokenResolver: async () => "token",
      contentResolver: async () => "hello",
      apiBaseUrl: "https://telegram.test",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            ok: false,
            error_code: 429,
            description: "Too Many Requests",
          }),
          { status: 429 },
        ),
    });

    await expect(
      limitedConnector.execute(task, {
        accountId: "account-1",
        userConfirmed: true,
      }),
    ).resolves.toMatchObject({ status: "blocked", reason: "platform_limit" });
  });

  it("rejects external API bases that are not HTTPS or loopback HTTP", () => {
    expect(
      () =>
        new TelegramConnector({
          tokenResolver: async () => "token",
          contentResolver: async () => "hello",
          apiBaseUrl: "http://telegram.example.test",
        }),
    ).toThrow("must use HTTPS");
  });

  it("blocks ambiguous 5xx delivery responses instead of returning retryable failure", async () => {
    const connector = new TelegramConnector({
      tokenResolver: async () => "token",
      contentResolver: async () => "hello",
      apiBaseUrl: "https://telegram.test",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            ok: false,
            error_code: 500,
            description: "Internal Server Error",
          }),
          { status: 500 },
        ),
    });

    const result = await connector.execute(task, {
      accountId: "account-1",
      userConfirmed: true,
    });

    expect(result).toMatchObject({
      status: "blocked",
      reason: "delivery_status_unknown",
    });
  });

  it("blocks transport failures as delivery-unknown", async () => {
    const connector = new TelegramConnector({
      tokenResolver: async () => "token",
      contentResolver: async () => "hello",
      apiBaseUrl: "https://telegram.test",
      fetchImpl: async () => {
        throw new Error("socket closed");
      },
    });

    const result = await connector.execute(task, {
      accountId: "account-1",
      userConfirmed: true,
    });

    expect(result).toMatchObject({
      status: "blocked",
      reason: "delivery_status_unknown",
    });
  });

  it("fails when linked content is unavailable", async () => {
    const connector = new TelegramConnector({
      tokenResolver: async () => "token",
      contentResolver: async () => undefined,
      apiBaseUrl: "https://telegram.test",
    });

    const result = await connector.execute(task, {
      accountId: "account-1",
      userConfirmed: true,
    });

    expect(result).toMatchObject({
      status: "failed",
      message: "The linked Telegram content item is empty or unavailable.",
    });
  });
});
