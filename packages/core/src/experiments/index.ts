/**
 * ORBIT Experimentation Engine
 *
 * Pure, deterministic experimentation primitives for the marketing operating graph.
 * This module never dispatches external work. It defines variants, validates
 * allocation invariants, assigns subjects deterministically, and summarizes
 * observed outcomes for the learning loop.
 */

import type { ConnectorOutcome } from "../connectors/contracts.js";
import type { MarketingInsight } from "../outcomes/index.js";
import type { Campaign } from "../types/index.js";

export type ExperimentStatus =
  "draft" | "running" | "paused" | "completed" | "archived";

export interface ExperimentVariant {
  readonly id: string;
  readonly name: string;
  readonly allocationPercent: number;
  readonly contentId?: string;
  readonly message?: string;
}

export interface ExperimentDefinition {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly hypothesis: string;
  readonly objectiveMetric: string;
  readonly status: ExperimentStatus;
  readonly variants: readonly ExperimentVariant[];
  readonly startsAt?: string;
  readonly endsAt?: string;
}

export interface ExperimentObservation {
  readonly experimentId: string;
  readonly workspaceId: string;
  readonly variantId: string;
  readonly subjectId: string;
  readonly observedAt: string;
  readonly exposed: boolean;
  readonly engaged: boolean;
  readonly converted: boolean;
  readonly value?: number;
}

export interface ExperimentVariantSummary {
  readonly variantId: string;
  readonly exposureCount: number;
  readonly engagementCount: number;
  readonly conversionCount: number;
  readonly totalValue: number;
  readonly engagementRate: number;
  readonly conversionRate: number;
}

export interface ExperimentSummary {
  readonly experimentId: string;
  readonly workspaceId: string;
  readonly observationCount: number;
  readonly variants: readonly ExperimentVariantSummary[];
}

export interface ExperimentValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export function validateExperiment(
  experiment: ExperimentDefinition,
): ExperimentValidationResult {
  const errors: string[] = [];

  if (!experiment.id.trim()) errors.push("id_required");
  if (!experiment.workspaceId.trim()) errors.push("workspace_required");
  if (!experiment.name.trim()) errors.push("name_required");
  if (!experiment.hypothesis.trim()) errors.push("hypothesis_required");
  if (
    !["draft", "running", "paused", "completed", "archived"].includes(
      experiment.status,
    )
  ) {
    errors.push("invalid_status");
  }

  if (!experiment.objectiveMetric.trim()) {
    errors.push("objective_metric_required");
  }

  if (experiment.variants.length < 2) {
    errors.push("at_least_two_variants_required");
  }

  const ids = new Set<string>();
  let allocation = 0;

  for (const variant of experiment.variants) {
    if (!variant.id.trim()) errors.push("variant_id_required");
    if (!variant.name.trim()) errors.push("variant_name_required");
    if (ids.has(variant.id)) errors.push("duplicate_variant_id");
    ids.add(variant.id);

    if (
      !Number.isFinite(variant.allocationPercent) ||
      variant.allocationPercent <= 0 ||
      variant.allocationPercent > 100
    ) {
      errors.push("invalid_variant_allocation");
    }

    allocation += variant.allocationPercent;
  }

  if (
    experiment.variants.length >= 2 &&
    Math.abs(allocation - 100) > 0.000001
  ) {
    errors.push("allocation_must_equal_100");
  }

  const startTime = experiment.startsAt
    ? Date.parse(experiment.startsAt)
    : undefined;
  const endTime = experiment.endsAt ? Date.parse(experiment.endsAt) : undefined;
  if (
    experiment.startsAt &&
    startTime !== undefined &&
    Number.isNaN(startTime)
  ) {
    errors.push("invalid_start_time");
  }
  if (experiment.endsAt && endTime !== undefined && Number.isNaN(endTime)) {
    errors.push("invalid_end_time");
  }
  if (
    startTime !== undefined &&
    endTime !== undefined &&
    !Number.isNaN(startTime) &&
    !Number.isNaN(endTime) &&
    startTime > endTime
  ) {
    errors.push("start_after_end");
  }

  return { valid: errors.length === 0, errors };
}

function stableBucket(input: string): number {
  // FNV-1a 32-bit over UTF-8 bytes. This keeps assignment portable across JS/Rust
  // implementations as long as they hash the same UTF-8 input string.
  let hash = 0x811c9dc5;
  const bytes = new TextEncoder().encode(input);

  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0) % 10000;
}

export function isExperimentActiveAt(
  experiment: ExperimentDefinition,
  now: string,
): boolean {
  if (experiment.status !== "running") return false;
  const nowTime = Date.parse(now);
  if (Number.isNaN(nowTime)) {
    throw new Error("invalid_now");
  }

  const startTime = experiment.startsAt
    ? Date.parse(experiment.startsAt)
    : undefined;
  const endTime = experiment.endsAt ? Date.parse(experiment.endsAt) : undefined;

  if (startTime !== undefined && Number.isNaN(startTime)) {
    throw new Error("invalid_start_time");
  }
  if (endTime !== undefined && Number.isNaN(endTime)) {
    throw new Error("invalid_end_time");
  }

  if (startTime !== undefined && nowTime < startTime) return false;
  if (endTime !== undefined && nowTime > endTime) return false;
  return true;
}

export function assignExperimentVariant(
  experiment: ExperimentDefinition,
  subjectId: string,
): ExperimentVariant {
  const validation = validateExperiment(experiment);
  if (!validation.valid) {
    throw new Error(`invalid_experiment:${validation.errors.join(",")}`);
  }

  if (!isExperimentActiveAt(experiment, new Date().toISOString())) {
    throw new Error("experiment_not_active");
  }

  if (!subjectId.trim()) {
    throw new Error("subject_required");
  }

  const bucket = stableBucket(
    `${experiment.workspaceId}:${experiment.id}:${subjectId}`,
  );
  const threshold = bucket / 100;

  let cumulative = 0;
  for (const variant of experiment.variants) {
    cumulative += variant.allocationPercent;
    if (threshold < cumulative) return variant;
  }

  // Floating point rounding can only reach here at the exact upper boundary.
  return experiment.variants[experiment.variants.length - 1]!;
}

export function summarizeExperiment(
  experiment: ExperimentDefinition,
  observations: readonly ExperimentObservation[],
): ExperimentSummary {
  if (!validateExperiment(experiment).valid) {
    throw new Error("invalid_experiment");
  }

  const declaredVariantIds = new Set(
    experiment.variants.map((variant) => variant.id),
  );
  const scoped = observations.filter(
    (observation) =>
      observation.experimentId === experiment.id &&
      observation.workspaceId === experiment.workspaceId &&
      declaredVariantIds.has(observation.variantId),
  );

  const variants = experiment.variants.map<ExperimentVariantSummary>(
    (variant) => {
      const rows = scoped.filter(
        (observation) => observation.variantId === variant.id,
      );
      const exposureCount = rows.filter(
        (observation) => observation.exposed,
      ).length;
      const engagementCount = rows.filter(
        (observation) => observation.exposed && observation.engaged,
      ).length;
      const conversionCount = rows.filter(
        (observation) => observation.exposed && observation.converted,
      ).length;
      const totalValue = rows.reduce(
        (sum, observation) =>
          sum +
          (observation.exposed && Number.isFinite(observation.value)
            ? (observation.value ?? 0)
            : 0),
        0,
      );

      return {
        variantId: variant.id,
        exposureCount,
        engagementCount,
        conversionCount,
        totalValue,
        engagementRate:
          exposureCount === 0 ? 0 : engagementCount / exposureCount,
        conversionRate:
          exposureCount === 0 ? 0 : conversionCount / exposureCount,
      };
    },
  );

  return {
    experimentId: experiment.id,
    workspaceId: experiment.workspaceId,
    observationCount: scoped.length,
    variants,
  };
}

export function observationsToLearningSignals(
  summary: ExperimentSummary,
): readonly string[] {
  const signals: string[] = [];
  if (summary.variants.length < 2) return signals;

  const byConversion = [...summary.variants].sort(
    (left, right) => right.conversionRate - left.conversionRate,
  );
  const byValue = [...summary.variants].sort(
    (left, right) => right.totalValue - left.totalValue,
  );

  const conversionLeader = byConversion[0]!;
  const valueLeader = byValue[0]!;

  if (conversionLeader.exposureCount > 0) {
    signals.push(
      `conversion_leader:${conversionLeader.variantId}:${conversionLeader.conversionRate.toFixed(6)}`,
    );
  }

  if (valueLeader.totalValue !== 0) {
    signals.push(
      `value_leader:${valueLeader.variantId}:${valueLeader.totalValue.toFixed(2)}`,
    );
  }

  // Deliberately factual: this is a learning signal, not a statistical-significance claim.
  signals.push("statistical_significance_not_claimed");
  return signals;
}

export interface ExperimentCampaignBinding {
  readonly experimentId: string;
  readonly workspaceId: string;
  readonly campaignId: string;
  readonly variants: readonly {
    readonly variantId: string;
    readonly allocationPercent: number;
    readonly contentId?: string;
    readonly message?: string;
  }[];
}

export interface ExperimentWorkStep {
  readonly id: string;
  readonly workspaceId: string;
  readonly campaignId: string;
  readonly experimentId: string;
  readonly variantId?: string;
  readonly kind: "assignment" | "execution" | "observation" | "learning";
  readonly title: string;
  readonly dependsOn: readonly string[];
  readonly externallyVisible: boolean;
  readonly requiresApproval: boolean;
}

export interface ExperimentCampaignWorkPlan {
  readonly binding: ExperimentCampaignBinding;
  readonly steps: readonly ExperimentWorkStep[];
}

function variantSourceKey(variant: ExperimentVariant): string {
  if (variant.contentId?.trim()) return "content:" + variant.contentId.trim();
  if (variant.message?.trim()) return "message:" + variant.message.trim();
  return "";
}

export function compileExperimentCampaignWorkPlan(input: {
  readonly experiment: ExperimentDefinition;
  readonly campaign: Campaign;
}): ExperimentCampaignWorkPlan {
  const { experiment, campaign } = input;

  if (experiment.workspaceId !== campaign.workspaceId) {
    throw new Error("experiment_campaign_workspace_mismatch");
  }
  if (!campaign.id.trim() || !experiment.id.trim()) {
    throw new Error("experiment_campaign_identity_required");
  }

  const experimentValidation = validateExperiment(experiment);
  if (!experimentValidation.valid) {
    throw new Error("experiment_campaign_invalid_experiment");
  }

  if (campaign.contentIds.some((contentId) => !contentId.trim())) {
    throw new Error("experiment_campaign_invalid_campaign_content");
  }

  const sourceKeys = new Set<string>();
  const variants = experiment.variants.map((variant) => {
    const sourceKey = variantSourceKey(variant);
    if (!sourceKey) {
      throw new Error("experiment_variant_source_required");
    }
    if (sourceKeys.has(sourceKey)) {
      throw new Error("experiment_variant_sources_must_be_unique");
    }
    sourceKeys.add(sourceKey);

    if (variant.contentId?.trim()) {
      if (!campaign.contentIds.includes(variant.contentId.trim())) {
        throw new Error("experiment_variant_content_not_attached_to_campaign");
      }
    }

    return {
      variantId: variant.id,
      allocationPercent: variant.allocationPercent,
      ...(variant.contentId?.trim()
        ? { contentId: variant.contentId.trim() }
        : {}),
      ...(variant.message?.trim() ? { message: variant.message.trim() } : {}),
    };
  });

  const prefix = campaign.id + ":experiment:" + experiment.id;
  const assignmentId = prefix + ":assignment";
  const executionSteps: ExperimentWorkStep[] = variants.map((variant) => ({
    id: prefix + ":execute:" + variant.variantId,
    workspaceId: campaign.workspaceId,
    campaignId: campaign.id,
    experimentId: experiment.id,
    variantId: variant.variantId,
    kind: "execution",
    title: "Execute experiment variant " + variant.variantId,
    dependsOn: [assignmentId],
    externallyVisible: true,
    requiresApproval: true,
  }));
  const observationId = prefix + ":observation";
  const learningId = prefix + ":learning";

  return {
    binding: {
      experimentId: experiment.id,
      workspaceId: campaign.workspaceId,
      campaignId: campaign.id,
      variants,
    },
    steps: [
      {
        id: assignmentId,
        workspaceId: campaign.workspaceId,
        campaignId: campaign.id,
        experimentId: experiment.id,
        kind: "assignment",
        title: "Assign deterministic experiment variants",
        dependsOn: [campaign.id + ":approval"],
        externallyVisible: false,
        requiresApproval: false,
      },
      ...executionSteps,
      {
        id: observationId,
        workspaceId: campaign.workspaceId,
        campaignId: campaign.id,
        experimentId: experiment.id,
        kind: "observation",
        title: "Collect experiment observations",
        dependsOn: executionSteps.map((step) => step.id),
        externallyVisible: false,
        requiresApproval: false,
      },
      {
        id: learningId,
        workspaceId: campaign.workspaceId,
        campaignId: campaign.id,
        experimentId: experiment.id,
        kind: "learning",
        title: "Write back evidence-backed experiment learning",
        dependsOn: [observationId],
        externallyVisible: false,
        requiresApproval: false,
      },
    ],
  };
}

export interface ExperimentStrategyLearningSignal {
  readonly id: string;
  readonly workspaceId: string;
  readonly experimentId: string;
  readonly kind:
    "conversion_observation" | "value_observation" | "insufficient_evidence";
  readonly variantId?: string;
  readonly metric?: string;
  readonly observedValue?: number;
  readonly message: string;
}

export interface ExperimentLearningWriteback {
  readonly workspaceId: string;
  readonly experimentId: string;
  readonly observedAt: string;
  readonly signals: readonly ExperimentStrategyLearningSignal[];
  readonly insights: readonly MarketingInsight[];
}

export interface ExperimentExecutionEvidence {
  readonly experimentId: string;
  readonly workspaceId: string;
  readonly variantId: string;
  readonly subjectId: string;
  readonly observedAt: string;
  readonly outcome: ConnectorOutcome;
  readonly engagementObserved?: boolean;
  readonly conversionObserved?: boolean;
  readonly value?: number;
}

function assertObservationTimestamp(observedAt: string): void {
  if (!observedAt.trim() || Number.isNaN(Date.parse(observedAt))) {
    throw new Error("invalid_observation_timestamp");
  }
}

export function buildExperimentObservationFromExecution(
  experiment: ExperimentDefinition,
  evidence: ExperimentExecutionEvidence,
): ExperimentObservation {
  if (
    experiment.id !== evidence.experimentId ||
    experiment.workspaceId !== evidence.workspaceId
  ) {
    throw new Error("experiment_execution_workspace_mismatch");
  }
  if (!evidence.variantId.trim() || !evidence.subjectId.trim()) {
    throw new Error("experiment_execution_identity_required");
  }
  if (!experiment.variants.some((variant) => variant.id === evidence.variantId)) {
    throw new Error("experiment_execution_unknown_variant");
  }
  assertObservationTimestamp(evidence.observedAt);

  const exposed = evidence.outcome.status === "succeeded";
  const engaged = evidence.engagementObserved ?? false;
  const converted = evidence.conversionObserved ?? false;

  if (!exposed && (engaged || converted)) {
    throw new Error("experiment_execution_outcome_without_exposure");
  }
  if (
    evidence.value !== undefined &&
    (!Number.isFinite(evidence.value) || evidence.value < 0)
  ) {
    throw new Error("experiment_execution_invalid_value");
  }

  return {
    experimentId: experiment.id,
    workspaceId: experiment.workspaceId,
    variantId: evidence.variantId,
    subjectId: evidence.subjectId,
    observedAt: evidence.observedAt,
    exposed,
    engaged,
    converted,
    ...(exposed && evidence.value !== undefined
      ? { value: evidence.value }
      : {}),
  };
}

function assertLearningTimestamp(now: string): void {
  if (!now.trim() || Number.isNaN(Date.parse(now))) {
    throw new Error("invalid_learning_timestamp");
  }
}

function stableVariantLeader(
  variants: readonly ExperimentVariantSummary[],
  selector: (variant: ExperimentVariantSummary) => number,
): ExperimentVariantSummary | undefined {
  return [...variants]
    .filter((variant) => variant.exposureCount > 0)
    .sort(
      (left, right) =>
        selector(right) - selector(left) ||
        right.exposureCount - left.exposureCount ||
        left.variantId.localeCompare(right.variantId),
    )[0];
}

export function buildExperimentLearningWriteback(
  experiment: ExperimentDefinition,
  summary: ExperimentSummary,
  now: string,
): ExperimentLearningWriteback {
  if (experiment.workspaceId !== summary.workspaceId) {
    throw new Error("experiment_learning_workspace_mismatch");
  }
  if (experiment.id !== summary.experimentId) {
    throw new Error("experiment_learning_experiment_mismatch");
  }
  assertLearningTimestamp(now);

  const observedVariants = summary.variants.filter(
    (variant) => variant.exposureCount > 0,
  );
  const signals: ExperimentStrategyLearningSignal[] = [];
  const insights: MarketingInsight[] = [];

  if (observedVariants.length === 0) {
    signals.push({
      id: "experiment:" + experiment.id + ":insufficient-evidence",
      workspaceId: experiment.workspaceId,
      experimentId: experiment.id,
      kind: "insufficient_evidence",
      message:
        "No exposed observations are available; no learning is written back.",
    });
    return {
      workspaceId: experiment.workspaceId,
      experimentId: experiment.id,
      observedAt: now,
      signals,
      insights,
    };
  }

  const conversionLeader = stableVariantLeader(
    observedVariants,
    (variant) => variant.conversionRate,
  );
  if (conversionLeader) {
    signals.push({
      id:
        "experiment:" +
        experiment.id +
        ":conversion:" +
        conversionLeader.variantId,
      workspaceId: experiment.workspaceId,
      experimentId: experiment.id,
      kind: "conversion_observation",
      variantId: conversionLeader.variantId,
      metric: "conversion_rate",
      observedValue: conversionLeader.conversionRate,
      message:
        "Observed conversion rate for " +
        conversionLeader.variantId +
        " is " +
        conversionLeader.conversionRate.toFixed(6) +
        "; statistical significance is not claimed.",
    });
    insights.push({
      id:
        "experiment-learning:" +
        experiment.id +
        ":conversion:" +
        conversionLeader.variantId,
      workspaceId: experiment.workspaceId,
      kind: "learning",
      title:
        "Observed experiment conversion signal: " + conversionLeader.variantId,
      summary:
        "Variant " +
        conversionLeader.variantId +
        " recorded an observed conversion rate of " +
        (conversionLeader.conversionRate * 100).toFixed(2) +
        "% across " +
        conversionLeader.exposureCount +
        " exposed observations. This is an observed signal only; statistical significance is not claimed.",
      metric: "conversion_rate",
      value: conversionLeader.conversionRate,
      confidence: 0,
      sourceIds: ["experiment:" + experiment.id],
      observedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  const valueLeader = stableVariantLeader(
    observedVariants,
    (variant) => variant.totalValue,
  );
  if (valueLeader && valueLeader.totalValue !== 0) {
    signals.push({
      id: "experiment:" + experiment.id + ":value:" + valueLeader.variantId,
      workspaceId: experiment.workspaceId,
      experimentId: experiment.id,
      kind: "value_observation",
      variantId: valueLeader.variantId,
      metric: "observed_value",
      observedValue: valueLeader.totalValue,
      message:
        "Observed total value for " +
        valueLeader.variantId +
        " is " +
        valueLeader.totalValue.toFixed(2) +
        "; this is descriptive evidence, not a causal or significance claim.",
    });
    insights.push({
      id:
        "experiment-learning:" +
        experiment.id +
        ":value:" +
        valueLeader.variantId,
      workspaceId: experiment.workspaceId,
      kind: "learning",
      title: "Observed experiment value signal: " + valueLeader.variantId,
      summary:
        "Variant " +
        valueLeader.variantId +
        " accumulated observed exposed value of " +
        valueLeader.totalValue.toFixed(2) +
        ". This is descriptive evidence only; statistical significance is not claimed, and causal attribution is not claimed.",
      metric: "observed_value",
      value: valueLeader.totalValue,
      confidence: 0,
      sourceIds: ["experiment:" + experiment.id],
      observedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  return {
    workspaceId: experiment.workspaceId,
    experimentId: experiment.id,
    observedAt: now,
    signals,
    insights,
  };
}


export * from "./inference.js";
