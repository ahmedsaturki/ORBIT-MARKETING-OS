import type { Campaign, Task } from "../types/index.js";

export interface CampaignValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

/**
 * Validate campaign invariants before task creation.
 */
export function validateCampaign(campaign: Campaign): CampaignValidationResult {
  const errors: string[] = [];

  if (!campaign.id.trim()) errors.push("campaign id is required");
  if (!campaign.name.trim()) errors.push("campaign name is required");
  if (campaign.accountIds.length === 0)
    errors.push("at least one account is required");
  if (!Number.isInteger(campaign.taskCount) || campaign.taskCount < 0) {
    errors.push("taskCount must be a non-negative integer");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Ensure queued tasks reference the campaign and account they were built for.
 */
export function validateTask(
  task: Task,
  campaign: Campaign,
): CampaignValidationResult {
  const errors: string[] = [];

  if (task.campaignId !== campaign.id) errors.push("task campaign mismatch");
  if (!campaign.accountIds.includes(task.accountId))
    errors.push("account is not part of campaign");
  if (task.maxAttempts < 1) errors.push("maxAttempts must be at least 1");
  if (task.priority < 0) errors.push("priority must be non-negative");

  return { valid: errors.length === 0, errors };
}
