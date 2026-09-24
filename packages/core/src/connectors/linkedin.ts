import type { ConnectorCapabilities, Platform, Task } from "../types/index.js";
import {
  assertSupportedTask,
  assertUserConfirmed,
  type ConnectorContext,
  type ConnectorOutcome,
  type PlatformConnector,
} from "./contracts.js";

export interface LinkedInConnectorOptions {
  readonly apiBaseUrl?: string;
  readonly apiVersion: string;
  readonly fetchImpl?: typeof fetch;
  readonly tokenResolver: () => Promise<string | undefined>;
  readonly authorResolver: () => Promise<string | undefined>;
  readonly contentResolver: (task: Task) => Promise<string | undefined>;
}

export class LinkedInConnector implements PlatformConnector {
  public readonly platform: Platform = "linkedin";
  public readonly capabilities: ConnectorCapabilities = {
    publish: true,
    messaging: false,
    comments: false,
    inbox: false,
    analytics: false,
    media: false,
  };

  private readonly apiBaseUrl: string;
  private readonly apiVersion: string;
  private readonly fetchImpl: typeof fetch;
  private readonly options: LinkedInConnectorOptions;

  public constructor(options: LinkedInConnectorOptions) {
    this.options = options;
    this.apiBaseUrl = normalizeApiBase(options.apiBaseUrl ?? "https://api.linkedin.com/rest");
    this.apiVersion = normalizeVersion(options.apiVersion);
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  public async connect(context: ConnectorContext): Promise<ConnectorOutcome> {
    try {
      const token = await this.options.tokenResolver();
      if (!token) {
        return {
          status: "blocked",
          reason: "authorization_required",
          message: "LinkedIn access token is missing.",
        };
      }
      if (!context.userConfirmed) {
        return {
          status: "blocked",
          reason: "authorization_required",
          message: "Explicit authorization is required before connecting LinkedIn.",
        };
      }

      const response = await this.fetchImpl("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: "Bearer " + token },
        signal: context.signal,
      });
      if (response.ok) return { status: "succeeded", message: "LinkedIn authorization verified." };
      return mapHttpFailure(response.status);
    } catch {
      return {
        status: "blocked",
        reason: "authorization_required",
        message: "LinkedIn authorization could not be verified.",
      };
    }
  }

  public async disconnect(): Promise<ConnectorOutcome> {
    return { status: "succeeded", message: "LinkedIn token release is handled by the local vault." };
  }

  public async execute(task: Task, context: ConnectorContext): Promise<ConnectorOutcome> {
    assertSupportedTask(this, task);
    assertUserConfirmed(context);

    const token = await this.options.tokenResolver();
    const author = await this.options.authorResolver();
    const commentary = await this.options.contentResolver(task);

    if (!token || !author) {
      return {
        status: "blocked",
        reason: "authorization_required",
        message: "LinkedIn token or author URN is missing.",
      };
    }
    if (!commentary?.trim()) {
      return {
        status: "failed",
        message: "LinkedIn post content is empty.",
      };
    }

    try {
      const response = await this.fetchImpl(this.apiBaseUrl + "/posts", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0",
          "Linkedin-Version": this.apiVersion,
        },
        body: JSON.stringify({
          author,
          commentary: commentary.trim(),
          visibility: "PUBLIC",
          distribution: {
            feedDistribution: "MAIN_FEED",
            targetEntities: [],
            thirdPartyDistributionChannels: [],
          },
          lifecycleState: "PUBLISHED",
          isReshareDisabledByAuthor: false,
        }),
        signal: context.signal,
      });

      if (response.status === 201) {
        return {
          status: "succeeded",
          externalId: response.headers.get("x-restli-id") ?? undefined,
          message: "LinkedIn post published.",
        };
      }
      return mapHttpFailure(response.status);
    } catch {
      return {
        status: "blocked",
        reason: "authorization_required",
        message: "LinkedIn delivery status is unknown after a network failure.",
      };
    }
  }

  public async sync(): Promise<ConnectorOutcome> {
    return {
      status: "blocked",
      reason: "authorization_required",
      message: "LinkedIn sync requires an explicit Community Management read scope and endpoint mapping.",
    };
  }
}

function normalizeApiBase(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("LinkedIn API base must use HTTPS");
  if (url.username || url.password) throw new Error("LinkedIn API base must not contain embedded credentials");
  return url.toString().replace(//$/, "");
}

function normalizeVersion(value: string): string {
  const normalized = value.trim();
  if (!/^d{6}$/.test(normalized)) {
    throw new Error("LinkedIn API version must be YYYYMM");
  }
  return normalized;
}

function mapHttpFailure(status: number): ConnectorOutcome {
  if (status === 401 || status === 403) {
    return {
      status: "blocked",
      reason: "authorization_required",
      message: "LinkedIn authorization does not permit this operation.",
    };
  }
  if (status === 429) {
    return {
      status: "blocked",
      reason: "platform_limit",
      message: "LinkedIn rate limit was reached.",
    };
  }
  if (status >= 500) {
    return {
      status: "blocked",
      reason: "platform_limit",
      message: "LinkedIn service returned a temporary server error.",
    };
  }
  return {
    status: "failed",
    message: "LinkedIn API request failed with HTTP " + status + ".",
  };
}
