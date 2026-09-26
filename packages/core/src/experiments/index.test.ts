import { describe, expect, it } from "vitest";
import {
  assignExperimentVariant,
  observationsToLearningSignals,
  summarizeExperiment,
  validateExperiment,
  type ExperimentDefinition,
} from "./index.js";

const experiment: ExperimentDefinition = {
  id: "exp-1",
  workspaceId: "ws-1",
  name: "Hook test",
  hypothesis: "A clearer benefit-led hook will improve conversion.",
  objectiveMetric: "conversion_rate",
  status: "running",
  variants: [
    { id: "control", name: "Control", allocationPercent: 50 },
    { id: "benefit", name: "Benefit", allocationPercent: 50 },
  ],
};

describe("experimentation", () => {
  it("validates allocation and identity invariants", () => {
    expect(validateExperiment(experiment).valid).toBe(true);
    expect(
      validateExperiment({
        ...experiment,
        variants: [
          { id: "control", name: "Control", allocationPercent: 60 },
          { id: "benefit", name: "Benefit", allocationPercent: 60 },
        ],
      }).errors,
    ).toContain("allocation_must_equal_100");
  });

  it("rejects malformed and inverted time windows", () => {
    const malformed = validateExperiment({
      ...experiment,
      startsAt: "not-a-date",
    });
    expect(malformed.errors).toContain("invalid_start_time");

    const inverted = validateExperiment({
      ...experiment,
      startsAt: "2026-09-27T00:00:00Z",
      endsAt: "2026-09-26T00:00:00Z",
    });
    expect(inverted.errors).toContain("start_after_end");
  });

  it("assigns the same subject deterministically", () => {
    const first = assignExperimentVariant(experiment, "subject-42");
    const second = assignExperimentVariant(experiment, "subject-42");
    expect(second.id).toBe(first.id);
  });

  it("keeps assignment workspace-scoped", () => {
    const other = assignExperimentVariant(
      { ...experiment, workspaceId: "ws-2" },
      "subject-42",
    );
    expect(["control", "benefit"]).toContain(other.id);
  });

  it("summarizes only same-workspace observations", () => {
    const summary = summarizeExperiment(experiment, [
      {
        experimentId: "exp-1",
        workspaceId: "ws-1",
        variantId: "control",
        subjectId: "a",
        observedAt: "2026-09-26T00:00:00Z",
        exposed: true,
        engaged: true,
        converted: false,
        value: 10,
      },
      {
        experimentId: "exp-1",
        workspaceId: "ws-1",
        variantId: "benefit",
        subjectId: "b",
        observedAt: "2026-09-26T00:00:00Z",
        exposed: true,
        engaged: true,
        converted: true,
        value: 25,
      },
      {
        experimentId: "exp-1",
        workspaceId: "ws-other",
        variantId: "benefit",
        subjectId: "c",
        observedAt: "2026-09-26T00:00:00Z",
        exposed: true,
        engaged: true,
        converted: true,
        value: 999,
      },
    ]);

    expect(summary.observationCount).toBe(2);
    expect(summary.variants).toEqual([
      expect.objectContaining({
        variantId: "control",
        exposureCount: 1,
        conversionCount: 0,
        conversionRate: 0,
      }),
      expect.objectContaining({
        variantId: "benefit",
        exposureCount: 1,
        conversionCount: 1,
        conversionRate: 1,
      }),
    ]);
  });

  it("emits bounded learning signals without claiming significance", () => {
    const summary = summarizeExperiment(experiment, [
      {
        experimentId: "exp-1",
        workspaceId: "ws-1",
        variantId: "benefit",
        subjectId: "b",
        observedAt: "2026-09-26T00:00:00Z",
        exposed: true,
        engaged: true,
        converted: true,
        value: 25,
      },
      {
        experimentId: "exp-1",
        workspaceId: "ws-1",
        variantId: "control",
        subjectId: "a",
        observedAt: "2026-09-26T00:00:00Z",
        exposed: true,
        engaged: false,
        converted: false,
      },
    ]);
    expect(observationsToLearningSignals(summary)).toContain(
      "conversion_leader:benefit:1.000000",
    );
    expect(observationsToLearningSignals(summary)).toContain(
      "statistical_significance_not_claimed",
    );
  });
});
