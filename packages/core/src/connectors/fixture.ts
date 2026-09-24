import type { ConnectorCapabilities, Platform, Task } from "../types/index.js";
import {
  assertSupportedTask,
  assertUserConfirmed,
  type ConnectorContext,
  type ConnectorOutcome,
  type PlatformConnector,
} from "./contracts.js";

export interface FixtureConnectorOptions {
  readonly platform: Platform;
  readonly challengeOnExecute?: boolean;
  readonly capabilities?: Partial<ConnectorCapabilities>;
}

export class FixtureConnector implements PlatformConnector {
  public readonly capabilities: ConnectorCapabilities;

  public readonly platform: Platform;
  private readonly challengeOnExecute: boolean;

  public constructor(options: FixtureConnectorOptions) {
    this.platform = options.platform;
    this.challengeOnExecute = options.challengeOnExecute ?? false;
    this.capabilities = {
      publish: true,
      messaging: true,
      comments: true,
      inbox: true,
      analytics: true,
      media: true,
      ...options.capabilities,
    };
  }

  public async connect(context: ConnectorContext): Promise<ConnectorOutcome> {
    if (!context.userConfirmed) {
      return {
        status: "blocked",
        reason: "authorization_required",
        message: "Fixture connector requires an explicit authorization boundary.",
      };
    }
    return { status: "succeeded", message: "fixture connected" };
  }

  public async disconnect(): Promise<ConnectorOutcome> {
    return { status: "succeeded", message: "fixture disconnected" };
  }

  public async execute(task: Task, context: ConnectorContext): Promise<ConnectorOutcome> {
    assertSupportedTask(this, task);
    assertUserConfirmed(context);

    if (this.challengeOnExecute) {
      return {
        status: "blocked",
        reason: "platform_challenge",
        message: "Fixture challenge: execution must stop for human intervention.",
      };
    }

    return {
      status: "succeeded",
      externalId: "fixture-" + task.id,
      message: "fixture execution succeeded",
    };
  }

  public async sync(): Promise<ConnectorOutcome> {
    return { status: "succeeded", message: "fixture sync succeeded" };
  }
}
