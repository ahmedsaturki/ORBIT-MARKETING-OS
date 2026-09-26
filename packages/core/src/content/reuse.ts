import type { ApprovalStatus, Platform } from "../types/index.js";

export interface ContentReuseCandidate {
  readonly contentId: string;
  readonly workspaceId: string;
  readonly platform: Platform;
  readonly body: string;
  readonly approvalStatus: ApprovalStatus;
  readonly createdAt: string;
}

export interface ContentReuseHistory {
  readonly contentId: string;
  readonly platform: Platform;
  readonly publishedAt: string;
  readonly body?: string;
}

export interface ContentReusePolicy {
  readonly cooldownHours: number;
  readonly maxReuseCount: number;
  readonly excludedPlatforms: readonly Platform[];
  readonly maxAgeDays: number;
  readonly requireApproval: boolean;
}

export type ContentReuseReason =
  | "approved"
  | "approval_required"
  | "platform_excluded"
  | "cooldown_active"
  | "reuse_limit_reached"
  | "stale"
  | "duplicate_variant";

export interface ContentReuseDecision {
  readonly allowed: boolean;
  readonly reasons: readonly ContentReuseReason[];
}

function hoursBetween(later: Date, earlier: Date): number {
  return Math.max(0, later.getTime() - earlier.getTime()) / 3_600_000;
}

function daysBetween(later: Date, earlier: Date): number {
  return Math.max(0, later.getTime() - earlier.getTime()) / 86_400_000;
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function evaluateContentReuse(
  candidate: ContentReuseCandidate,
  history: readonly ContentReuseHistory[],
  policy: ContentReusePolicy,
  now = new Date(),
): ContentReuseDecision {
  if (!Number.isFinite(policy.cooldownHours) || policy.cooldownHours < 0) {
    throw new Error("cooldownHours must be a finite non-negative number");
  }
  if (
    !Number.isInteger(policy.maxReuseCount) ||
    policy.maxReuseCount < 1
  ) {
    throw new Error("maxReuseCount must be a positive integer");
  }
  if (!Number.isFinite(policy.maxAgeDays) || policy.maxAgeDays < 1) {
    throw new Error("maxAgeDays must be a finite positive number");
  }

  const candidateDate = new Date(candidate.createdAt);
  if (Number.isNaN(candidateDate.getTime())) {
    throw new Error("candidate.createdAt must be a valid date");
  }
  if (Number.isNaN(now.getTime())) {
    throw new Error("now must be a valid date");
  }

  const reasons: ContentReuseReason[] = [];
  if (policy.requireApproval) {
    if (candidate.approvalStatus === "approved") reasons.push("approved");
    else reasons.push("approval_required");
  } else {
    reasons.push("approved");
  }

  if (policy.excludedPlatforms.includes(candidate.platform)) {
    reasons.push("platform_excluded");
  }

  const relevantHistory = history.filter(
    (item) => item.contentId === candidate.contentId,
  );
  for (const item of relevantHistory) {
    if (Number.isNaN(new Date(item.publishedAt).getTime())) {
      throw new Error("history.publishedAt must be a valid date");
    }
  }

  const published = relevantHistory.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() -
      new Date(a.publishedAt).getTime(),
  );

  if (published.length >= policy.maxReuseCount) {
    reasons.push("reuse_limit_reached");
  }

  const latest = published[0];
  if (
    latest &&
    hoursBetween(now, new Date(latest.publishedAt)) < policy.cooldownHours
  ) {
    reasons.push("cooldown_active");
  }

  if (daysBetween(now, candidateDate) > policy.maxAgeDays) {
    reasons.push("stale");
  }

  const candidateVariant = normalize(candidate.body);
  for (const item of history) {
    if (Number.isNaN(new Date(item.publishedAt).getTime())) {
      throw new Error("history.publishedAt must be a valid date");
    }
  }

  const duplicate = history.some(
    (item) =>
      item.contentId !== candidate.contentId &&
      item.platform === candidate.platform &&
      typeof item.body === "string" &&
      normalize(item.body) === candidateVariant,
  );
  if (duplicate) reasons.push("duplicate_variant");

  const blocked = reasons.some((reason) => reason !== "approved");
  return {
    allowed: !blocked,
    reasons,
  };
}
