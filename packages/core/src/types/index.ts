export type Platform = "facebook" | "instagram" | "telegram" | "whatsapp" | "linkedin" | "tiktok";

export type AccountStatus = "connected" | "needs_refresh" | "restricted" | "paused";

export type CampaignStatus = "draft" | "scheduled" | "running" | "paused" | "completed" | "failed";

export type TaskStatus = "pending" | "running" | "succeeded" | "failed" | "blocked" | "cancelled";

export interface SocialAccount {
  readonly id: string;
  readonly platform: Platform;
  readonly displayName: string;
  readonly username?: string;
  readonly status: AccountStatus;
  readonly createdAt: string;
  readonly lastActivityAt?: string;
}

export interface Campaign {
  readonly id: string;
  readonly name: string;
  readonly status: CampaignStatus;
  readonly accountIds: readonly string[];
  readonly taskCount: number;
  readonly createdAt: string;
}

export interface Task {
  readonly id: string;
  readonly campaignId: string;
  readonly accountId: string;
  readonly platform: Platform;
  readonly kind: "publish" | "message" | "comment" | "sync";
  readonly priority: number;
  readonly status: TaskStatus;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly availableAt: string;
  readonly createdAt: string;
}

export interface AuditEvent {
  readonly id: string;
  readonly timestamp: string;
  readonly category: "account" | "campaign" | "task" | "security" | "connector";
  readonly action: string;
  readonly outcome: "success" | "failure" | "blocked";
  readonly actor: "user" | "system" | "connector";
  readonly entityId?: string;
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
}
