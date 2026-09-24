import type { Approval, Campaign, SocialAccount, Task } from "../types/index.js";
import { ConnectorRegistry } from "../connectors/registry.js";
import {
  assertSupportedTask,
  type ConnectorOutcome,
} from "../connectors/contracts.js";
import {
  evaluateExecutionPolicy,
  type ExecutionPolicyContext,
} from "./executionPolicy.js";

export type ExecutionRunnerResult =
  | {
      readonly status: "blocked";
      readonly reason:
        | "policy"
        | "connector_unavailable"
        | "unsupported_action"
        | "platform_challenge"
        | "authorization_required"
        | "platform_limit"
        | "delivery_status_unknown";
      readonly message: string;
    }
  | {
      readonly status: "succeeded";
      readonly externalId?: string;
      readonly message: string;
    }
  | {
      readonly status: "failed";
      readonly message: string;
    };

export interface ExecutionRunnerInput {
  readonly account: SocialAccount;
  readonly campaign: Campaign;
  readonly task: Task;
  readonly approval?: Approval;
  readonly actionsToday: number;
  readonly dailyLimit: number;
  readonly consecutiveFailures: number;
  readonly circuitBreakerThreshold: number;
  readonly connectorRegistry: ConnectorRegistry;
  readonly userConfirmed: boolean;
}

function policyContext(input: ExecutionRunnerInput): ExecutionPolicyContext {
  return {
    account: input.account,
    campaign: input.campaign,
    task: input.task,
    approval: input.approval,
    actionsToday: input.actionsToday,
    dailyLimit: input.dailyLimit,
    consecutiveFailures: input.consecutiveFailures,
    circuitBreakerThreshold: input.circuitBreakerThreshold,
  };
}

/**
 * Policy-and-connector runner for one task.
 *
 * Every externally-visible task passes policy, connector lookup, capability
 * compatibility, and explicit user authorization before connector execution.
 * Persistence/audit orchestration is provided by executeClaimedTask().
 */
export class ExecutionRunner {
  public constructor(private readonly registry: ConnectorRegistry) {}

  public async run(input: Omit<ExecutionRunnerInput, "connectorRegistry">): Promise<ExecutionRunnerResult> {
    if (input.task.status !== "running") {
      return {
        status: "blocked",
        reason: "policy",
        message: "Only claimed running tasks may be executed.",
      };
    }

    const decision = evaluateExecutionPolicy(policyContext({ ...input, connectorRegistry: this.registry }));
    if (!decision.allowed) {
      return {
        status: "blocked",
        reason: "policy",
        message: decision.message,
      };
    }

    if (input.task.kind !== "sync" && !input.userConfirmed) {
      return {
        status: "blocked",
        reason: "authorization_required",
        message: "Explicit user confirmation is required before any external action.",
      };
    }

    const connector = this.registry.get(input.task.platform);
    if (!connector) {
      return {
        status: "blocked",
        reason: "connector_unavailable",
        message: "No connector is registered for the task platform.",
      };
    }

    if (input.task.kind !== "sync") {
      try {
        assertSupportedTask(connector, input.task);
      } catch (error: unknown) {
        return {
          status: "blocked",
          reason: "unsupported_action",
          message: error instanceof Error ? error.message : "Connector rejected the task.",
        };
      }
    }

    let outcome: ConnectorOutcome;
    try {
      outcome =
        input.task.kind === "sync"
          ? await connector.sync({
              accountId: input.account.id,
              userConfirmed: input.userConfirmed,
            })
          : await connector.execute(input.task, {
              accountId: input.account.id,
              userConfirmed: input.userConfirmed,
            });
    } catch (error: unknown) {
      return {
        status: "failed",
        message: error instanceof Error ? error.message : "Connector execution failed.",
      };
    }

    if (outcome.status === "succeeded") {
      return {
        status: "succeeded",
        externalId: outcome.externalId,
        message: outcome.message,
      };
    }

    if (outcome.status === "blocked") {
      return {
        status: "blocked",
        reason: outcome.reason,
        message: outcome.message,
      };
    }

    return {
      status: "failed",
      message: outcome.message,
    };
  }
}
