import type { Task } from "../types/index.js";
import {
  assertSupportedTask,
  assertUserConfirmed,
  type ConnectorContext,
  type ConnectorOutcome,
  type PlatformConnector,
} from "./contracts.js";

export interface TelegramConnectorOptions {
  readonly tokenResolver: (accountId: string) => Promise<string | undefined>;
  readonly contentResolver: (contentId: string, platform: "telegram") => Promise<string | undefined>;
  readonly apiBaseUrl?: string;
  readonly fetchImpl?: typeof fetch;
}

interface TelegramApiResponse<T> {
  readonly ok: boolean;
  readonly result?: T;
  readonly description?: string;
  readonly error_code?: number;
}

interface TelegramRequestResult<T> {
  readonly payload: TelegramApiResponse<T>;
  readonly statusCode: number;
}

interface TelegramUser {
  readonly id: number;
  readonly is_bot: boolean;
  readonly first_name: string;
  readonly username?: string;
}

interface TelegramMessage {
  readonly message_id: number;
}

const DEFAULT_API = "https://api.telegram.org";

function normalizeApiBaseUrl(value: string): string {
  const url = new URL(value);
  const loopback = new Set(["localhost", "127.0.0.1", "::1"]);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback.has(url.hostname))) {
    throw new Error("Telegram API base URL must use HTTPS (or HTTP only for loopback fixtures)");
  }
  if (url.username || url.password) {
    throw new Error("Telegram API base URL must not contain embedded credentials");
  }
  return url.toString().replace(/\/$/, "");
}

export class TelegramConnector implements PlatformConnector {
  public readonly platform = "telegram" as const;

  public readonly capabilities = {
    publish: true,
    messaging: true,
    comments: false,
    inbox: false,
    analytics: false,
    media: false,
  } as const;

  private readonly tokenResolver: TelegramConnectorOptions["tokenResolver"];
  private readonly contentResolver: TelegramConnectorOptions["contentResolver"];
  private readonly apiBaseUrl: string;
  private readonly fetchImpl: typeof fetch;

  public constructor(options: TelegramConnectorOptions) {
    this.tokenResolver = options.tokenResolver;
    this.contentResolver = options.contentResolver;
    this.apiBaseUrl = normalizeApiBaseUrl(options.apiBaseUrl ?? DEFAULT_API);
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  public async connect(context: ConnectorContext): Promise<ConnectorOutcome> {
    const token = await this.tokenResolver(context.accountId);
    if (!token) {
      return {
        status: "blocked",
        reason: "authorization_required",
        message: "Telegram bot token is not available for this account.",
      };
    }

    try {
      const response = await this.request<TelegramUser>(token, "getMe", undefined, context.signal);
      if (!response.payload.ok || !response.payload.result) {
        return this.mapApiFailure(response.payload, response.statusCode);
      }
      return {
        status: "succeeded",
        externalId: String(response.payload.result.id),
        message: `Telegram bot authenticated: @${response.payload.result.username ?? response.payload.result.first_name}`,
      };
    } catch (error: unknown) {
      return {
        status: "failed",
        message: error instanceof Error ? error.message : "Telegram connection failed.",
      };
    }
  }

  public async disconnect(context: ConnectorContext): Promise<ConnectorOutcome> {
    return {
      status: "succeeded",
      message: `Telegram connector disconnected for ${context.accountId}.`,
    };
  }

  public async execute(task: Task, context: ConnectorContext): Promise<ConnectorOutcome> {
    assertSupportedTask(this, task);
    if (!context.userConfirmed) {
      return {
        status: "blocked",
        reason: "user_confirmation_required",
        message: "Explicit user confirmation is required before Telegram sends a message.",
      };
    }

    if (!task.destinationId) {
      return {
        status: "failed",
        message: "Telegram task requires a destinationId.",
      };
    }

    if (!task.contentId) {
      return {
        status: "failed",
        message: "Telegram external tasks require a contentId.",
      };
    }

    const token = await this.tokenResolver(context.accountId);
    if (!token) {
      return {
        status: "blocked",
        reason: "authorization_required",
        message: "Telegram bot token is not available for this account.",
      };
    }

    const text = await this.contentResolver(task.contentId, "telegram");
    if (!text?.trim()) {
      return {
        status: "failed",
        message: "The linked Telegram content item is empty or unavailable.",
      };
    }

    try {
      const response = await this.request<TelegramMessage>(
        token,
        "sendMessage",
        {
          chat_id: task.destinationId,
          text: text.slice(0, 4096),
        },
        context.signal,
      );

      if (!response.payload.ok || !response.payload.result) {
        return this.mapApiFailure(response.payload, response.statusCode);
      }

      return {
        status: "succeeded",
        externalId: String(response.payload.result.message_id),
        message: "Telegram message sent successfully.",
      };
    } catch {
      return {
        status: "blocked",
        reason: "delivery_status_unknown",
        message: "Telegram delivery status is unknown. Verify delivery before retrying to avoid duplicate messages.",
      };
    }
  }

  public async sync(context: ConnectorContext): Promise<ConnectorOutcome> {
    return this.connect(context);
  }

  private async request<T>(
    token: string,
    method: string,
    body: Readonly<Record<string, string>> | undefined,
    signal?: AbortSignal,
  ): Promise<TelegramRequestResult<T>> {
    const request: RequestInit = {
      method: body ? "POST" : "GET",
      signal: signal ?? AbortSignal.timeout(15_000),
      ...(body
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
    };
    const response = await this.fetchImpl(
      `${this.apiBaseUrl}/bot${encodeURIComponent(token)}/${method}`,
      request,
    );

    let payload: TelegramApiResponse<T>;
    try {
      payload = (await response.json()) as TelegramApiResponse<T>;
    } catch {
      throw new Error(`Telegram returned HTTP ${response.status} with an invalid JSON body.`);
    }

    return {
      payload,
      statusCode: response.status,
    };
  }

  private mapApiFailure<T>(
    response: TelegramApiResponse<T>,
    statusCode: number,
  ): ConnectorOutcome {
    if (response.error_code === 401 || response.error_code === 403) {
      return {
        status: "blocked",
        reason: "authorization_required",
        message: "Telegram rejected the bot authorization or permissions.",
      };
    }

    if (response.error_code === 429) {
      return {
        status: "blocked",
        reason: "platform_limit",
        message: "Telegram rate-limited the bot request; execution must back off.",
      };
    }

    if (statusCode === 408 || (statusCode >= 500 && statusCode <= 599)) {
      return {
        status: "blocked",
        reason: "delivery_status_unknown",
        message: "Telegram delivery status is ambiguous. Verify delivery before retrying.",
      };
    }

    return {
      status: "failed",
      message: response.description
        ? `Telegram API error: ${response.description.slice(0, 300)}`
        : "Telegram API request failed.",
    };
  }
}
