import type { QueueTask, TaskActionType } from "../types/index.js";

export type CampaignStatus = "draft" | "active" | "paused" | "completed";

export interface Campaign {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly status: CampaignStatus;
  readonly createdAt: string;
}

export interface CampaignMember {
  readonly campaignId: string;
  readonly workspaceId: string;
  readonly accountId: string;
  readonly addedAt: string;
}

export class CampaignError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CampaignError";
  }
}

const KNOWN_ACTIONS: readonly TaskActionType[] = [
  "post_group",
  "post_page",
  "send_dm",
  "comment",
  "follow",
  "like",
  "whatsapp_msg",
  "telegram_post",
];

function requireNonEmpty(value: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new CampaignError(`${field} must be a non-empty string`);
  }
  return value;
}

export function createCampaign(input: {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly createdAt: string;
}): Campaign {
  requireNonEmpty(input.id, "campaign id");
  requireNonEmpty(input.workspaceId, "workspace id");
  requireNonEmpty(input.name, "campaign name");
  requireNonEmpty(input.createdAt, "createdAt");
  return {
    id: input.id,
    workspaceId: input.workspaceId,
    name: input.name,
    status: "draft",
    createdAt: input.createdAt,
  };
}

export function activateCampaign(campaign: Campaign): Campaign {
  if (campaign.status === "completed") {
    throw new CampaignError(
      `campaign ${campaign.id} is completed and cannot be reactivated`,
    );
  }
  if (campaign.status === "active") {
    return campaign;
  }
  return { ...campaign, status: "active" };
}

export function addCampaignMember(
  campaign: Campaign,
  members: readonly CampaignMember[],
  member: {
    readonly accountId: string;
    readonly addedAt: string;
    readonly workspaceId: string;
    readonly campaignId: string;
  },
): readonly CampaignMember[] {
  requireNonEmpty(member.accountId, "account id");
  requireNonEmpty(member.addedAt, "addedAt");
  // Membership is always scoped to the campaign that declares it.
  if (
    member.campaignId !== campaign.id ||
    member.workspaceId !== campaign.workspaceId
  ) {
    throw new CampaignError(
      "membership must reference the campaign id and its workspace",
    );
  }
  const exists = members.some(
    (m) =>
      m.campaignId === campaign.id &&
      m.workspaceId === campaign.workspaceId &&
      m.accountId === member.accountId,
  );
  if (exists) return members;
  return [
    ...members,
    {
      campaignId: campaign.id,
      workspaceId: campaign.workspaceId,
      accountId: member.accountId,
      addedAt: member.addedAt,
    },
  ];
}

export function isCampaignMember(
  members: readonly CampaignMember[],
  campaignId: string,
  workspaceId: string,
  accountId: string,
): boolean {
  return members.some(
    (m) =>
      m.campaignId === campaignId &&
      m.workspaceId === workspaceId &&
      m.accountId === accountId,
  );
}

export interface CampaignTaskInput {
  readonly id: string;
  readonly platform: string;
  readonly accountId: string;
  readonly actionType: TaskActionType;
  readonly target: string;
  readonly scheduledTime: string;
  readonly text?: string;
  readonly maxRetries?: number;
  readonly priority?: QueueTask["priority"];
}

export interface TaskSink {
  enqueue(task: QueueTask): unknown;
}

/**
 * Campaign → task integration. Fail-closed: the campaign must be active, the
 * target account must be an explicit member of the same campaign/workspace,
 * and all task fields must be present before anything reaches the queue.
 */
export async function enqueueCampaignTask(
  campaign: Campaign,
  members: readonly CampaignMember[],
  input: CampaignTaskInput,
  sink: TaskSink,
): Promise<QueueTask> {
  if (campaign.status !== "active") {
    throw new CampaignError(
      `campaign ${campaign.id} is not active (status ${campaign.status})`,
    );
  }
  requireNonEmpty(input.id, "task id");
  requireNonEmpty(input.platform, "platform");
  requireNonEmpty(input.target, "target");
  requireNonEmpty(input.scheduledTime, "scheduledTime");
  if (!KNOWN_ACTIONS.includes(input.actionType)) {
    throw new CampaignError(`unknown action type: ${String(input.actionType)}`);
  }
  // Membership enforcement: unknown/non-member accounts never enqueue.
  if (
    !isCampaignMember(
      members,
      campaign.id,
      campaign.workspaceId,
      input.accountId,
    )
  ) {
    throw new CampaignError(
      `account ${input.accountId} is not a member of campaign ${campaign.id}`,
    );
  }

  const task: QueueTask = {
    id: input.id,
    workspaceId: campaign.workspaceId,
    campaignId: campaign.id,
    platform: input.platform,
    accountId: input.accountId,
    actionType: input.actionType,
    target: input.target,
    payload: input.text !== undefined ? { text: input.text } : {},
    status: "queued",
    priority: input.priority ?? "normal",
    retries: 0,
    maxRetries: input.maxRetries ?? 3,
    scheduledTime: input.scheduledTime,
  };
  await sink.enqueue(task);
  return task;
}
