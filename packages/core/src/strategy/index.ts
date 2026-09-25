export type StrategyStatus = "draft" | "active" | "paused" | "archived";

export type ObjectiveMetric =
  | "awareness"
  | "engagement"
  | "leads"
  | "opportunities"
  | "revenue"
  | "retention";

export interface MarketingObjective {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly metric: ObjectiveMetric;
  readonly target: number;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly status: StrategyStatus;
}

export interface AudienceDefinition {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly description: string;
  readonly attributes: Readonly<Record<string, string | number | boolean>>;
  readonly exclusions: readonly string[];
}

export interface OfferDefinition {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly promise: string;
  readonly proofPoints: readonly string[];
  readonly constraints: readonly string[];
}

export interface StrategyDocument {
  readonly id: string;
  readonly workspaceId: string;
  readonly version: number;
  readonly objectiveIds: readonly string[];
  readonly audienceIds: readonly string[];
  readonly offerIds: readonly string[];
  readonly positioning: string;
  readonly keyMessages: readonly string[];
  readonly contentPillars: readonly string[];
  readonly channels: readonly string[];
  readonly status: StrategyStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface StrategyValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export function validateStrategy(
  strategy: StrategyDocument,
): StrategyValidationResult {
  const errors: string[] = [];

  if (!strategy.positioning.trim()) errors.push("positioning_required");
  if (strategy.objectiveIds.length === 0) errors.push("objective_required");
  if (strategy.audienceIds.length === 0) errors.push("audience_required");
  if (strategy.offerIds.length === 0) errors.push("offer_required");
  if (strategy.keyMessages.length === 0) errors.push("key_message_required");
  if (strategy.channels.length === 0) errors.push("channel_required");

  return { valid: errors.length === 0, errors };
}
