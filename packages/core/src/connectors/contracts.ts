import type {
  ConnectorCapabilities,
  Platform,
  Task,
  TaskKind,
} from "../types/index.js";

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
      readonly reason:
        | "user_confirmation_required"
        | "platform_challenge"
        | "authorization_required"
        | "platform_limit"
        | "delivery_status_unknown";
      readonly message: string;
    }
  | {
      readonly status: "failed";
      readonly message: string;
    };

export interface PlatformConnector {
  readonly platform: Platform;
  readonly capabilities: ConnectorCapabilities;
  connect(context: ConnectorContext): Promise<ConnectorOutcome>;
  disconnect(context: ConnectorContext): Promise<ConnectorOutcome>;
  execute(task: Task, context: ConnectorContext): Promise<ConnectorOutcome>;
  sync(context: ConnectorContext): Promise<ConnectorOutcome>;
}

export function assertUserConfirmed(context: ConnectorContext): void {
  if (!context.userConfirmed) {
    throw new Error(
      "Explicit user confirmation is required for external actions",
    );
  }
}

const TASK_CAPABILITY: Readonly<
  Record<Exclude<TaskKind, "sync" | "engage">, keyof ConnectorCapabilities>
> = {
  publish: "publish",
  message: "messaging",
  comment: "comments",
};

export function assertSupportedTask(
  connector: PlatformConnector,
  task: Task,
): void {
  if (task.platform !== connector.platform) {
    throw new Error("Task platform does not match connector platform");
  }
  if (task.kind === "sync") return;

  if (task.kind === "engage") {
    if (!connector.capabilities.comments && !connector.capabilities.messaging) {
      throw new Error("Connector does not support engagement actions");
    }
    return;
  }

  const capability = TASK_CAPABILITY[task.kind];
  if (!connector.capabilities[capability]) {
    throw new Error("Connector does not support task kind: " + task.kind);
  }
}
