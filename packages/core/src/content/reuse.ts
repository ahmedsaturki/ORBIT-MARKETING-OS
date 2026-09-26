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
}

export interface ContentReusePolicy {
  readonly cooldownHours: number;
  readonly maxReuseCount: number;
  readonly excludedPlatforms: readonly Platform[];
  readonly maxAgeDays: number;
  readonly requireApproval: boolean;
}

export interface ContentReuseDecision {
  readonly allowed: boolean;
  readonly reasons: readonly (
    | "approved"
    | "approval_required"
    | "platform_excluded"
    | "cooldown_active"
    | "reuse_limit_reached"
    | "stale"
    | "duplicate_variant"
  )[];
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

  const reasons: ContentReuseDecision["reasons"] = [];
  if (policy.requireApproval) {
    if (candidate.approvalStatus === "approved") reasons.push("approved");
    else reasons.push("approval_required");
  } else {
    reasons.push("approved");
  }

  if (policy.excludedPlatforms.includes(candidate.platform)) {
    reasons.push("platform_excluded");
  }

  const published = history
    .filter((item) => item.contentId === candidate.contentId)
    .sort(
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

  if (daysBetween(now, new Date(candidate.createdAt)) > policy.maxAgeDays) {
    reasons.push("stale");
  }

  const candidateVariant = normalize(candidate.body);
  const duplicate = history.some(
    (item) =>
      item.contentId !== candidate.contentId &&
      item.platform === candidate.platform &&
      normalize(item.contentId) === candidateVariant,
  );
  if (duplicate) reasons.push("duplicate_variant");

  const blocked = reasons.some((reason) => reason !== "approved");
  return {
    allowed: !blocked,
    reasons,
  };
}
