export type ApprovalStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "changes_requested";

export interface Approval {
  readonly id: string;
  readonly workspaceId: string;
  readonly contentId: string;
  readonly requestedBy: string;
  readonly reviewerIds: readonly string[];
  readonly status: ApprovalStatus;
  readonly decidedBy?: string;
  readonly decidedAt?: string;
  readonly note?: string;
}

export interface ContentItem {
  readonly id: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly body: string;
  readonly platformVariants: Readonly<Record<string, string | undefined>>;
  readonly approvalStatus: ApprovalStatus;
  readonly tags: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly mediaIds?: readonly string[];
  readonly campaignId?: string;
}

export type TaskStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "retrying"
  | "cancelled"
  | "blocked";

export type TaskActionType =
  | "post_group"
  | "post_page"
  | "send_dm"
  | "comment"
  | "follow"
  | "like"
  | "whatsapp_msg"
  | "telegram_post";

export interface QueueTask {
  readonly id: string;
  readonly workspaceId: string;
  readonly campaignId?: string;
  readonly platform: string;
  readonly accountId: string;
  readonly actionType: TaskActionType;
  readonly target: string;
  readonly payload: {
    readonly text?: string;
    readonly mediaUrl?: string;
    readonly recipient?: string;
  };
  readonly status: TaskStatus;
  readonly priority: "high" | "normal" | "low";
  readonly retries: number;
  readonly maxRetries: number;
  readonly lastError?: string;
  readonly scheduledTime: string;
  readonly executedTime?: string;
  readonly delayAppliedSeconds?: number;
}

export interface PolicyContext {
  readonly workspaceId: string;
  readonly accountId: string;
  readonly platform: string;
  readonly actionType: TaskActionType;
  readonly now: string;
  readonly dailyActionsDone: number;
  readonly dailyLimit: number;
  readonly accountStatus: "active" | "paused" | "restricted" | "warming_up";
  readonly challengeActive: boolean;
  readonly breakerOpen: boolean;
  readonly approvalAllowed: boolean;
}

export type PolicyDecisionReason =
  | "allowed"
  | "daily_limit"
  | "account_paused"
  | "account_restricted"
  | "challenge_active"
  | "circuit_open"
  | "approval_required";

export interface PolicyDecision {
  readonly allowed: boolean;
  readonly reason: PolicyDecisionReason;
  readonly detail?: string;
}

export type ConnectorCapability =
  | "publish"
  | "comment"
  | "direct_message"
  | "read_inbox"
  | "analytics";

export interface ConnectorDescriptor {
  readonly id: string;
  readonly platform: string;
  readonly capabilities: readonly ConnectorCapability[];
  readonly mode: "official" | "browser_assisted" | "local_import" | "notification_assisted";
}

export type ConnectorResult<T = unknown> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: string; readonly requiresIntervention: boolean };

export type CircuitState = "closed" | "open" | "half_open";

export interface AuditEntry {
  readonly id: string;
  readonly workspaceId: string;
  readonly actorId: string;
  readonly action: string;
  readonly entityRef: string;
  readonly timestamp: string;
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
  readonly prevHash?: string;
  readonly hash: string;
}
