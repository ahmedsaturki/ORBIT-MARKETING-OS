import type { Approval, ApprovalStatus, ContentItem } from "../types/index.js";

export interface ApprovalDecision {
  readonly status: ApprovalStatus;
  readonly allowedToPublish: boolean;
  readonly reason:
    "not_required" | "pending" | "approved" | "rejected" | "changes_requested";
}

/**
 * Evaluates whether a content item has cleared its configured approval gate.
 */
export function evaluateApproval(
  content: ContentItem,
  approval?: Approval,
): ApprovalDecision {
  if (content.approvalStatus === "approved") {
    return { status: "approved", allowedToPublish: true, reason: "approved" };
  }

  if (!approval) {
    return {
      status: content.approvalStatus,
      allowedToPublish: false,
      reason: "not_required",
    };
  }

  switch (approval.status) {
    case "approved":
      return { status: "approved", allowedToPublish: true, reason: "approved" };
    case "rejected":
      return {
        status: "rejected",
        allowedToPublish: false,
        reason: "rejected",
      };
    case "changes_requested":
      return {
        status: "changes_requested",
        allowedToPublish: false,
        reason: "changes_requested",
      };
    case "pending":
      return { status: "pending", allowedToPublish: false, reason: "pending" };
    case "draft":
      return { status: "draft", allowedToPublish: false, reason: "pending" };
  }
}
