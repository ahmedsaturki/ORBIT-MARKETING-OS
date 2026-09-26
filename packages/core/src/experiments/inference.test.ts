import { describe, expect, it } from "vitest";
import { inferExperiment, proportionInterval } from "./inference.js";
import type { ExperimentDefinition, ExperimentSummary } from "./index.js";

function summary(): ExperimentSummary {
  return {
    experimentId: "exp-1",
    workspaceId: "ws-1",
    observationCount: 120,
    variants: [
      {
        variantId: "control",
        exposureCount: 60,
        engagementCount: 18,
        conversionCount: 6,
        totalValue: 120,
        engagementRate: 0.3,
        conversionRate: 0.1,
      },
      {
        variantId: "benefit",
        exposureCount: 60,
        engagementCount: 30,
        conversionCount: 12,
        totalValue: 210,
        engagementRate: 0.5,
        conversionRate: 0.2,
      },
    ],
  };
}

describe("experiment inference", () => {
  it("returns a bounded Wilson interval", () => {
    const interval = proportionInterval(18, 60, 0.95);
    expect(interval.estimate).toBeCloseTo(0.3, 10);
    expect(interval.lower).toBeGreaterThanOrEqual(0);
    expect(interval.upper).toBeLessThanOrEqual(1);
    expect(interval.lower).toBeLessThan(interval.estimate);
    expect(interval.upper).toBeGreaterThan(interval.estimate);
    expect(interval.confidenceLevel).toBe(0.95);
  });

  it("handles zero exposure without fabricating certainty", () => {
    expect(proportionInterval(0, 0)).toEqual({
      successes: 0,
      trials: 0,
      estimate: 0,
      lower: 0,
      upper: 0,
      confidenceLevel: 0.95,
    });
  });

  it("rejects invalid interval inputs", () => {
    expect(() => proportionInterval(2, 1)).toThrow(
      "successes_cannot_exceed_trials",
    );
    expect(() => proportionInterval(1, 10, 0.97)).toThrow(
      "unsupported_confidence_level",
    );
  });

  it("builds pairwise descriptive uncertainty comparisons", () => {
    const experiment: Parameters<typeof inferExperiment>[0] = {
      id: "exp-1",
      workspaceId: "ws-1",
      name: "Test",
      hypothesis: "Benefit improves conversion",
      objectiveMetric: "conversion_rate",
      status: "running",
      variants: [
        { id: "control", name: "Control", allocationPercent: 50 },
        { id: "benefit", name: "Benefit", allocationPercent: 50 },
      ],
    };
    const inferred = inferExperiment(experiment, summary(), 0.95);

    expect(inferred.experimentId).toBe("exp-1");
    expect(inferred.workspaceId).toBe("ws-1");
    expect(inferred.variants).toHaveLength(2);
    expect(inferred.variants[1]?.conversion.estimate).toBeCloseTo(0.2, 10);
    expect(inferred.variants[0]?.allocationTargetShare).toBe(0.5);
    expect(inferred.variants[1]?.observedExposureShare).toBe(0.5);
    expect(inferred.maxAbsoluteAllocationDrift).toBe(0);

    const conversion = inferred.comparisons.find(
      (comparison) =>
        comparison.metric === "conversion_rate" &&
        comparison.leftVariantId === "control" &&
        comparison.rightVariantId === "benefit",
    );
    expect(conversion).toBeDefined();
    expect(conversion?.rateDifference).toBeCloseTo(-0.1, 10);
    expect(conversion?.lower).toBeLessThanOrEqual(conversion!.rateDifference);
    expect(conversion?.upper).toBeGreaterThanOrEqual(conversion!.rateDifference);
    expect(conversion?.method).toBe("newcombe_wilson_difference");
    expect(conversion?.interpretation).toBe(
      "descriptive_uncertainty_interval",
    );
  });

  it("rejects summary identity mismatch", () => {
    const experiment: Parameters<typeof inferExperiment>[0] = {
      id: "exp-1",
      workspaceId: "ws-1",
      name: "Test",
      hypothesis: "Benefit improves conversion",
      objectiveMetric: "conversion_rate",
      status: "running",
      variants: [
        { id: "control", name: "Control", allocationPercent: 50 },
        { id: "benefit", name: "Benefit", allocationPercent: 50 },
      ],
    };
    expect(() =>
      inferExperiment(
        experiment,
        { ...summary(), workspaceId: "other-workspace" },
      ),
    ).toThrow("experiment_inference_identity_mismatch");
  });

  it("rejects malformed variant summaries", () => {
    const experiment: Parameters<typeof inferExperiment>[0] = {
      id: "exp-1",
      workspaceId: "ws-1",
      name: "Test",
      hypothesis: "Benefit improves conversion",
      objectiveMetric: "conversion_rate",
      status: "running",
      variants: [
        { id: "control", name: "Control", allocationPercent: 50 },
        { id: "benefit", name: "Benefit", allocationPercent: 50 },
      ],
    };
    expect(() =>
      inferExperiment(experiment, {
        ...summary(),
        variants: [
          ...summary().variants,
          { ...summary().variants[1]!, variantId: "unexpected" },
        ],
      }),
    ).toThrow("experiment_inference_unknown_variant");
  });

  it("reports allocation drift from observed exposure", () => {
    const experiment: Parameters<typeof inferExperiment>[0] = {
      id: "exp-1",
      workspaceId: "ws-1",
      name: "Test",
      hypothesis: "Benefit improves conversion",
      objectiveMetric: "conversion_rate",
      status: "running",
      variants: [
        { id: "control", name: "Control", allocationPercent: 50 },
        { id: "benefit", name: "Benefit", allocationPercent: 50 },
      ],
    };
    const inferred = inferExperiment(
      experiment,
      {
        ...summary(),
        variants: [
          { ...summary().variants[0]!, exposureCount: 70 },
          { ...summary().variants[1]!, exposureCount: 30 },
        ],
      },
    );
    expect(inferred.variants[0]?.allocationDrift).toBeCloseTo(0.2, 10);
    expect(inferred.maxAbsoluteAllocationDrift).toBeCloseTo(0.2, 10);
  });

  it("uses stable confidence levels in the returned contract", () => {
    const experiment: Parameters<typeof inferExperiment>[0] = {
      id: "exp-1",
      workspaceId: "ws-1",
      name: "Test",
      hypothesis: "Benefit improves conversion",
      objectiveMetric: "conversion_rate",
      status: "running",
      variants: [
        { id: "control", name: "Control", allocationPercent: 50 },
        { id: "benefit", name: "Benefit", allocationPercent: 50 },
      ],
    };
    expect(inferExperiment(experiment, summary(), 0.99).confidenceLevel).toBe(
      0.99,
    );
  });
});
