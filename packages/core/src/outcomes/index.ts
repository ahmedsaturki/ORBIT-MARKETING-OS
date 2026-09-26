export type OpportunityStage =
  | "new"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost"
  | "nurture";

export type InsightKind =
  | "performance"
  | "anomaly"
  | "learning"
  | "trend"
  | "recommendation";

export interface MarketingOpportunity {
  readonly id: string;
  readonly workspaceId: string;
  readonly contactId: string;
  readonly campaignId?: string;
  readonly name: string;
  readonly stage: OpportunityStage;
  readonly value: number;
  readonly currency: string;
  readonly probability: number;
  readonly source?: string;
  readonly ownerId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MarketingInsight {
  readonly id: string;
  readonly workspaceId: string;
  readonly kind: InsightKind;
  readonly title: string;
  readonly summary: string;
  readonly metric?: string;
  readonly value?: number;
  readonly confidence: number;
  readonly sourceIds: readonly string[];
  readonly observedAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

const OPPORTUNITY_STAGES: readonly OpportunityStage[] = [
  "new",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
  "nurture",
];

const INSIGHT_KINDS: readonly InsightKind[] = [
  "performance",
  "anomaly",
  "learning",
  "trend",
  "recommendation",
];

export interface MarketingInsightInput
  extends Omit<MarketingInsight, "sourceIds"> {
  readonly sourceIds: readonly string[];
}

export function createMarketingInsight(
  input: MarketingInsightInput,
): MarketingInsight {
  return {
    ...input,
    sourceIds: [...input.sourceIds],
  };
}

export function validateOpportunity(
  opportunity: MarketingOpportunity,
): string[] {
  const errors: string[] = [];
  if (!opportunity.id.trim()) errors.push("id_required");
  if (!opportunity.workspaceId.trim()) errors.push("workspace_required");
  if (!opportunity.contactId.trim()) errors.push("contact_required");
  if (!opportunity.name.trim()) errors.push("name_required");
  if (!OPPORTUNITY_STAGES.includes(opportunity.stage))
    errors.push("invalid_stage");
  if (!Number.isFinite(opportunity.value) || opportunity.value < 0)
    errors.push("invalid_value");
  if (!/^[A-Z]{3}$/.test(opportunity.currency)) errors.push("invalid_currency");
  if (
    !Number.isFinite(opportunity.probability) ||
    opportunity.probability < 0 ||
    opportunity.probability > 100
  ) {
    errors.push("invalid_probability");
  }
  return errors;
}

export function validateInsight(insight: MarketingInsight): string[] {
  const errors: string[] = [];
  if (!insight.id.trim()) errors.push("id_required");
  if (!insight.workspaceId.trim()) errors.push("workspace_required");
  if (!INSIGHT_KINDS.includes(insight.kind)) errors.push("invalid_kind");
  if (!insight.title.trim()) errors.push("title_required");
  if (!insight.summary.trim()) errors.push("summary_required");
  if (
    !Number.isFinite(insight.confidence) ||
    insight.confidence < 0 ||
    insight.confidence > 1
  )
    errors.push("invalid_confidence");
  if (insight.sourceIds.length === 0) errors.push("source_required");
  if (insight.value !== undefined && !Number.isFinite(insight.value))
    errors.push("invalid_value");
  return errors;
}
