import type { Approval, Campaign, ContentItem, SocialAccount, Task } from "../types/index.js";
import { evaluateApproval } from "./approval.js";

export type ExecutionBlockReason =
  | "workspace_mismatch"
  | "account_mismatch"
  | "task_platform_mismatch"
  | "account_not_connected"
  | "approval_required"
  | "approval_scope_mismatch"
  | "content_required"
  | "content_scope_mismatch"
  | "content_not_approved"
  | "content_unavailable"
  | "destination_required"
  | "daily_limit_reached"
  | "circuit_breaker_open"
  | "campaign_not_runnable";

export interface ExecutionPolicyContext {
  readonly account: SocialAccount;
  readonly campaign: Campaign;
  readonly task: Task;
  readonly content?: ContentItem;
  readonly approval?: Approval;
  readonly actionsToday: number;
  readonly dailyLimit: number;
  readonly consecutiveFailures: number;
  readonly circuitBreakerThreshold: number;
}

export type ExecutionPolicyDecision =
  | {
      readonly allowed: true;
      readonly reason: "allowed";
      readonly message: string;
    }
  | {
      readonly allowed: false;
      readonly reason: ExecutionBlockReason;
      readonly message: string;
    };

/**
 * Applies deterministic pre-flight safety gates before a connector is allowed
 * to perform an external side effect.
 */
export function evaluateExecutionPolicy(context: ExecutionPolicyContext): ExecutionPolicyDecision {
  if (
    context.task.workspaceId !== context.account.workspaceId ||
    context.task.workspaceId !== context.campaign.workspaceId
  ) {
    return {
      allowed: false,
      reason: "workspace_mismatch",
      message: "Account, campaign, and task must belong to the same workspace.",
    };
  }

  if (
    context.task.accountId !== context.account.id ||
    context.task.campaignId !== context.campaign.id
  ) {
    return {
      allowed: false,
      reason: "account_mismatch",
      message: "Task references do not match the selected account and campaign.",
    };
  }

  if (context.task.platform !== context.account.platform) {
    return {
      allowed: false,
      reason: "task_platform_mismatch",
      message: "Task platform does not match the account platform.",
    };
  }

  if (
    context.approval &&
    (context.approval.workspaceId !== context.task.workspaceId ||
      !context.campaign.contentIds.includes(context.approval.contentId) ||
      (context.task.kind !== "sync" &&
        context.task.contentId !== undefined &&
        context.approval.contentId !== context.task.contentId))
  ) {
    return {
      allowed: false,
      reason: "approval_scope_mismatch",
      message: "The approval does not belong to the task workspace and campaign content.",
    };
  }

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

  if (context.task.kind !== "sync" && !context.task.destinationId) {
    return {
      allowed: false,
      reason: "destination_required",
      message: "External tasks must identify a destination before execution.",
    };
  }

  if (context.task.kind !== "sync" && !context.task.contentId) {
    return {
      allowed: false,
      reason: "content_required",
      message: "Content tasks must reference a content item before execution.",
    };
  }

  if (context.task.kind !== "sync" && !context.content) {
    return {
      allowed: false,
      reason: "content_unavailable",
      message: "The referenced content must be loaded before external execution.",
    };
  }

  if (context.task.kind !== "sync" && context.content) {
    if (
      context.content.workspaceId !== context.task.workspaceId ||
      context.content.id !== context.task.contentId ||
      !context.campaign.contentIds.includes(context.content.id)
    ) {
      return {
        allowed: false,
        reason: "content_scope_mismatch",
        message: "The content item does not belong to the task workspace and campaign.",
      };
    }

    if (context.content.approvalStatus !== "approved") {
      return {
        allowed: false,
        reason: "content_not_approved",
        message: "The referenced content is not approved for external delivery.",
      };
    }
  }

  if (
    context.task.contentId &&
    !context.campaign.contentIds.includes(context.task.contentId)
  ) {
    return {
      allowed: false,
      reason: "content_scope_mismatch",
      message: "The task content does not belong to the campaign.",
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
