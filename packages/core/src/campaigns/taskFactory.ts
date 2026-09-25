import type { Campaign, Platform, Task } from "../types/index.js";

export interface CampaignTaskTemplate {
  readonly taskKind: Task["kind"];
  readonly priority?: number;
  readonly maxAttempts?: number;
  readonly availableAt?: string;
  readonly contentId?: string;
  readonly destinationId?: string;
}

/**
 * Expand a campaign into one task per targeted account.
 *
 * Task creation is deterministic for the supplied inputs and performs no
 * external I/O; the connector/runtime layer owns actual execution.
 */
export function buildCampaignTasks(
  campaign: Campaign,
  platform: Platform,
  template: CampaignTaskTemplate,
): readonly Task[] {
  if (campaign.accountIds.length === 0) {
    throw new Error("Cannot create tasks for a campaign without accounts");
  }
  if (new Set(campaign.accountIds).size !== campaign.accountIds.length) {
    throw new Error("Campaign account ids must be unique");
  }
  if (!campaign.id.trim() || !campaign.workspaceId.trim()) {
    throw new Error("Campaign id and workspace id are required");
  }
  if (template.priority !== undefined && (!Number.isInteger(template.priority) || template.priority < 0)) {
    throw new RangeError("priority must be a non-negative integer");
  }

  const createdAt = new Date().toISOString();
  const availableAt = template.availableAt ?? createdAt;
  const priority = template.priority ?? 0;
  const maxAttempts = template.maxAttempts ?? 3;
  const contentId =
    template.contentId ??
    (template.taskKind === "sync" ? undefined : campaign.contentIds.length === 1 ? campaign.contentIds[0] : undefined);

  if (template.taskKind !== "sync" && campaign.contentIds.length > 1 && !template.contentId) {
    throw new Error("contentId is required when a campaign targets multiple content items");
  }
  if (contentId && !campaign.contentIds.includes(contentId)) {
    throw new Error("contentId is not part of campaign");
  }

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) {
    throw new RangeError("maxAttempts must be an integer between 1 and 10");
  }

  return campaign.accountIds.map((accountId) => {
    const contentPart = contentId ?? "none";
    const taskKey =
      campaign.id +
      ":task:" +
      platform +
      ":" +
      template.taskKind +
      ":" +
      accountId +
      ":" +
      contentPart;

    return {
      id: taskKey,
      workspaceId: campaign.workspaceId,
      campaignId: campaign.id,
      accountId,
      platform,
      kind: template.taskKind,
      ...(contentId ? { contentId } : {}),
      ...(template.destinationId ? { destinationId: template.destinationId } : {}),
      priority,
      status: "pending",
      attempts: 0,
      maxAttempts,
      availableAt,
      idempotencyKey: taskKey,
      createdAt,
    };
  });
}
