import type { Platform, Task } from "../types/index.js";

export interface ConnectorContext {
  readonly accountId: string;
  readonly userConfirmed: boolean;
  readonly signal?: AbortSignal;
}

export type ConnectorOutcome =
  | {
      readonly status: "succeeded";
      readonly externalId?: string;
      readonly message: string;
    }
  | {
      readonly status: "blocked";
      readonly reason: "user_confirmation_required" | "platform_challenge" | "authorization_required" | "platform_limit";
      readonly message: string;
    }
  | {
      readonly status: "failed";
      readonly message: string;
    };

export interface PlatformConnector {
  readonly platform: Platform;
  connect(context: ConnectorContext): Promise<ConnectorOutcome>;
  disconnect(context: ConnectorContext): Promise<ConnectorOutcome>;
  execute(task: Task, context: ConnectorContext): Promise<ConnectorOutcome>;
  sync(context: ConnectorContext): Promise<ConnectorOutcome>;
}

export function assertUserConfirmed(context: ConnectorContext): void {
  if (!context.userConfirmed) {
    throw new Error("Explicit user confirmation is required for external actions");
  }
}
