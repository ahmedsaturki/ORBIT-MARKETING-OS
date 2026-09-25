export type Platform = "facebook" | "instagram" | "telegram" | "whatsapp" | "linkedin" | "tiktok";

export type AccountStatus = "connected" | "needs_refresh" | "restricted" | "paused";
export type CampaignStatus = "draft" | "awaiting_approval" | "scheduled" | "running" | "paused" | "completed" | "failed";
export type TaskStatus = "pending" | "awaiting_approval" | "awaiting_user_action" | "running" | "succeeded" | "failed" | "blocked" | "cancelled";
export type ApprovalStatus = "draft" | "pending" | "approved" | "rejected" | "changes_requested";
export type ConversationStatus = "new" | "interested" | "potential_customer" | "complaint" | "closed";
export type ContactStatus = "new" | "interested" | "sold" | "lost";
export type TaskKind = "publish" | "message" | "comment" | "sync" | "engage";
export type Actor = "user" | "system" | "connector";

export interface SocialAccount {
  readonly id: string;
  readonly workspaceId: string;
  readonly platform: Platform;
  readonly displayName: string;
  readonly username?: string;
  readonly status: AccountStatus;
  readonly healthScore: number;
  readonly createdAt: string;
  readonly lastActivityAt?: string;
}

export interface ContentItem {
  readonly id: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly body: string;
  readonly platformVariants: Readonly<Record<Platform, string | undefined>>;
  readonly approvalStatus: ApprovalStatus;
  readonly tags: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface Campaign {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly status: CampaignStatus;
  readonly accountIds: readonly string[];
  readonly contentIds: readonly string[];
  readonly taskCount: number;
  readonly createdAt: string;
}

export interface Task {
  readonly id: string;
  readonly workspaceId: string;
  readonly campaignId: string;
  readonly accountId: string;
  readonly platform: Platform;
  readonly kind: TaskKind;
  readonly contentId?: string;
  readonly destinationId?: string;
  readonly priority: number;
  readonly status: TaskStatus;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly availableAt: string;
  readonly idempotencyKey: string;
  readonly createdAt: string;
}

export interface Conversation {
  readonly id: string;
  readonly workspaceId: string;
  readonly accountId: string;
  readonly platform: Platform;
  readonly externalId: string;
  readonly contactId?: string;
  readonly status: ConversationStatus;
  readonly assigneeId?: string;
  readonly lastMessageAt?: string;
}

export interface Contact {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly phone?: string;
  readonly email?: string;
  readonly source?: string;
  readonly status: ContactStatus;
  readonly tags: readonly string[];
  readonly followUpAt?: string;
}

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

export interface ConnectorCapabilities {
  readonly publish: boolean;
  readonly messaging: boolean;
  readonly comments: boolean;
  readonly inbox: boolean;
  readonly analytics: boolean;
  readonly media: boolean;
}

export interface ConnectorHealth {
  readonly platform: Platform;
  readonly connected: boolean;
  readonly authenticated: boolean;
  readonly challengeDetected: boolean;
  readonly checkedAt: string;
}

export interface AuditEvent {
  readonly id: string;
  readonly timestamp: string;
  readonly workspaceId: string;
  readonly category: "account" | "campaign" | "task" | "security" | "connector" | "content" | "media" | "automation" | "inbox" | "crm" | "sync" | "backup" | "license";
  readonly action: string;
  readonly outcome: "success" | "failure" | "blocked";
  readonly actor: Actor;
  readonly entityId?: string;
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
}
