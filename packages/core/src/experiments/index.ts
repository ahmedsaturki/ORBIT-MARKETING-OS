/**
 * ORBIT Experimentation Engine
 *
 * Pure, deterministic experimentation primitives for the marketing operating graph.
 * This module never dispatches external work. It defines variants, validates
 * allocation invariants, assigns subjects deterministically, and summarizes
 * observed outcomes for the learning loop.
 */

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

export function assignExperimentVariant(
  experiment: ExperimentDefinition,
  subjectId: string,
): ExperimentVariant {
  const validation = validateExperiment(experiment);
  if (!validation.valid) {
    throw new Error(`invalid_experiment:${validation.errors.join(",")}`);
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
