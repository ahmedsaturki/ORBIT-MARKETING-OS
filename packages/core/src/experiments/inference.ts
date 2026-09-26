/**
 * Deterministic, descriptive statistical inference for ORBIT experiments.
 *
 * These intervals quantify uncertainty around observed rates. They do not
 * establish causality, platform-wide significance, or immunity from variance.
 */

import type {
  ExperimentDefinition,
  ExperimentSummary,
  ExperimentVariantSummary,
} from "./index.js";

export interface ProportionInterval {
  readonly successes: number;
  readonly trials: number;
  readonly estimate: number;
  readonly lower: number;
  readonly upper: number;
  readonly confidenceLevel: number;
}

export interface ExperimentVariantInference {
  readonly variantId: string;
  readonly exposureCount: number;
  readonly engagement: ProportionInterval;
  readonly conversion: ProportionInterval;
  readonly totalValue: number;
  readonly allocationTargetShare: number;
  readonly observedExposureShare: number;
  readonly allocationDrift: number;
}

export interface ExperimentRateComparison {
  readonly leftVariantId: string;
  readonly rightVariantId: string;
  readonly metric: "engagement_rate" | "conversion_rate";
  readonly rateDifference: number;
  readonly lower: number;
  readonly upper: number;
  readonly confidenceLevel: number;
  readonly method: "newcombe_wilson_difference";
  readonly interpretation: "descriptive_uncertainty_interval";
}

export interface ExperimentInference {
  readonly experimentId: string;
  readonly workspaceId: string;
  readonly confidenceLevel: number;
  readonly variants: readonly ExperimentVariantInference[];
  readonly comparisons: readonly ExperimentRateComparison[];
  readonly maxAbsoluteAllocationDrift: number;
}

const CRITICAL_VALUES: Readonly<Record<string, number>> = {
  "0.8": 1.2815515655446004,
  "0.9": 1.6448536269514722,
  "0.95": 1.959963984540054,
  "0.98": 2.3263478740408408,
  "0.99": 2.5758293035489004,
};

function normalizedConfidenceLevel(value: number): number {
  if (!Number.isFinite(value)) throw new Error("invalid_confidence_level");
  const key = value.toFixed(2);
  if (!(key in CRITICAL_VALUES)) {
    throw new Error(
      "unsupported_confidence_level:use_one_of_0.80_0.90_0.95_0.98_0.99",
    );
  }
  return Number(key);
}

function criticalValue(confidenceLevel: number): number {
  return CRITICAL_VALUES[normalizedConfidenceLevel(confidenceLevel).toFixed(2)]!;
}

function validateCount(name: string, value: number): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(name + "_must_be_a_non_negative_integer");
  }
  return value;
}

/**
 * Wilson score interval for a single observed proportion.
 *
 * A zero-exposure variant returns an exact zero estimate with [0, 0].
 */
export function proportionInterval(
  successes: number,
  trials: number,
  confidenceLevel = 0.95,
): ProportionInterval {
  const cleanSuccesses = validateCount("successes", successes);
  const cleanTrials = validateCount("trials", trials);
  if (cleanSuccesses > cleanTrials) {
    throw new Error("successes_cannot_exceed_trials");
  }
  const level = normalizedConfidenceLevel(confidenceLevel);

  if (cleanTrials === 0) {
    return {
      successes: 0,
      trials: 0,
      estimate: 0,
      lower: 0,
      upper: 0,
      confidenceLevel: level,
    };
  }

  const estimate = cleanSuccesses / cleanTrials;
  const z = criticalValue(level);
  const z2 = z * z;
  const denominator = 1 + z2 / cleanTrials;
  const center = (estimate + z2 / (2 * cleanTrials)) / denominator;
  const margin =
    (z /
      denominator *
      Math.sqrt(
        (estimate * (1 - estimate)) / cleanTrials +
          z2 / (4 * cleanTrials * cleanTrials),
      )) || 0;

  return {
    successes: cleanSuccesses,
    trials: cleanTrials,
    estimate,
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
    confidenceLevel: level,
  };
}

/**
 * Newcombe's interval for the difference of two independent proportions,
 * constructed from the component Wilson intervals. The result is returned
 * as a descriptive uncertainty interval, not as an automatic causal claim.
 */
function differenceInterval(
  left: ProportionInterval,
  right: ProportionInterval,
): { lower: number; upper: number } {
  return {
    lower: left.estimate - right.estimate -
      Math.sqrt(
        (left.estimate - left.lower) ** 2 +
          (right.upper - right.estimate) ** 2,
      ),
    upper: left.estimate - right.estimate +
      Math.sqrt(
        (left.upper - left.estimate) ** 2 +
          (right.estimate - right.lower) ** 2,
      ),
  };
}

function inferVariant(
  variant: ExperimentVariantSummary,
  targetShare: number,
  totalExposures: number,
  confidenceLevel: number,
): ExperimentVariantInference {
  return {
    variantId: variant.variantId,
    exposureCount: variant.exposureCount,
    engagement: proportionInterval(
      variant.engagementCount,
      variant.exposureCount,
      confidenceLevel,
    ),
    conversion: proportionInterval(
      variant.conversionCount,
      variant.exposureCount,
      confidenceLevel,
    ),
    totalValue: variant.totalValue,
    allocationTargetShare: targetShare,
    observedExposureShare:
      totalExposures === 0 ? 0 : variant.exposureCount / totalExposures,
    allocationDrift:
      (totalExposures === 0 ? 0 : variant.exposureCount / totalExposures) -
      targetShare,
  };
}

export function inferExperiment(
  experiment: ExperimentDefinition,
  summary: ExperimentSummary,
  confidenceLevel = 0.95,
): ExperimentInference {
  const level = normalizedConfidenceLevel(confidenceLevel);
  if (
    experiment.id !== summary.experimentId ||
    experiment.workspaceId !== summary.workspaceId
  ) {
    throw new Error("experiment_inference_identity_mismatch");
  }

  const targets = new Map(
    experiment.variants.map((variant) => [
      variant.id,
      variant.allocationPercent / 100,
    ]),
  );
  const summaryVariantIds = new Set<string>();
  for (const variant of summary.variants) {
    if (summaryVariantIds.has(variant.variantId)) {
      throw new Error("experiment_inference_duplicate_variant");
    }
    summaryVariantIds.add(variant.variantId);
    if (!targets.has(variant.variantId)) {
      throw new Error("experiment_inference_unknown_variant");
    }
  }
  const totalExposures = summary.variants.reduce(
    (sum, variant) => sum + variant.exposureCount,
    0,
  );
  const variants = summary.variants.map((variant) =>
    inferVariant(
      variant,
      targets.get(variant.variantId) ?? 0,
      totalExposures,
      level,
    ),
  );
  const comparisons: ExperimentRateComparison[] = [];

  for (let leftIndex = 0; leftIndex < variants.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < variants.length;
      rightIndex += 1
    ) {
      const left = variants[leftIndex]!;
      const right = variants[rightIndex]!;

      for (const metric of ["engagement", "conversion"] as const) {
        const interval = differenceInterval(left[metric], right[metric]);
        comparisons.push({
          leftVariantId: left.variantId,
          rightVariantId: right.variantId,
          metric:
            metric === "engagement" ? "engagement_rate" : "conversion_rate",
          rateDifference: left[metric].estimate - right[metric].estimate,
          lower: Math.max(-1, interval.lower),
          upper: Math.min(1, interval.upper),
          confidenceLevel: level,
          method: "newcombe_wilson_difference",
          interpretation: "descriptive_uncertainty_interval",
        });
      }
    }
  }

  return {
    experimentId: summary.experimentId,
    workspaceId: summary.workspaceId,
    confidenceLevel: level,
    variants,
    comparisons,
    maxAbsoluteAllocationDrift: variants.reduce(
      (max, variant) => Math.max(max, Math.abs(variant.allocationDrift)),
      0,
    ),
  };
}
