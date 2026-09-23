import type { Approval, Campaign, SocialAccount, Task } from "../types/index.js";
import { evaluateApproval } from "./approval.js";

export type ExecutionBlockReason =
  | "account_not_connected"
  | "approval_required"
  | "daily_limit_reached"
  | "circuit_breaker_open"
  | "campaign_not_runnable";

export interface ExecutionPolicyContext {
  readonly account: SocialAccount;
  readonly campaign: Campaign;
  readonly task: Task;
  readonly approval?: Approval;
  readonly actionsToday: number;
  readonly dailyLimit: number;
  readonly consecutiveFailures: number;
  readonly circuitBreakerThreshold: number;
}

export interface ExecutionPolicyDecision {
  readonly allowed: boolean;
  readonly reason: "allowed" | ExecutionBlockReason;
  readonly message: string;
}

/**
 * Applies deterministic pre-flight safety gates before a connector is allowed
 * to perform an external side effect.
 */
export function evaluateExecutionPolicy(context: ExecutionPolicyContext): ExecutionPolicyDecision {
  if (context.account.status !== "connected") {
    return {
      allowed: false,
      reason: "account_not_connected",
      message: "The social account is not in a connected state.",
    };
  }

  if (!["scheduled", "running"].includes(context.campaign.status)) {
    return {
      allowed: false,
      reason: "campaign_not_runnable",
      message: "The campaign is not currently runnable.",
    };
  }

  if (context.actionsToday >= context.dailyLimit) {
    return {
      allowed: false,
      reason: "daily_limit_reached",
      message: "The configured daily action limit has been reached.",
    };
  }

  if (context.consecutiveFailures >= context.circuitBreakerThreshold) {
    return {
      allowed: false,
      reason: "circuit_breaker_open",
      message: "The execution circuit breaker is open after repeated failures.",
    };
  }

  if (context.task.kind !== "sync") {
    const approval = evaluateApproval(
      {
        id: context.task.id,
        workspaceId: context.task.workspaceId,
        title: context.task.kind,
        body: "",
        platformVariants: {
          facebook: undefined,
          instagram: undefined,
          telegram: undefined,
          whatsapp: undefined,
          linkedin: undefined,
          tiktok: undefined,
        },
        approvalStatus: context.approval?.status ?? "pending",
        tags: [],
        createdAt: context.task.createdAt,
        updatedAt: context.task.createdAt,
      },
      context.approval,
    );

    if (!approval.allowedToPublish) {
      return {
        allowed: false,
        reason: "approval_required",
        message: "An explicit approval is required before an external action.",
      };
    }
  }

  return { allowed: true, reason: "allowed", message: "All execution safety gates passed." };
}
