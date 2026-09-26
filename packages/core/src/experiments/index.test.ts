import { describe, expect, it } from "vitest";
import {
  assignExperimentVariant,
  buildExperimentLearningWriteback,
  compileExperimentCampaignWorkPlan,
  isExperimentActiveAt,
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

    const malformedEnd = validateExperiment({
      ...experiment,
      endsAt: "not-a-date",
    });
    expect(malformedEnd.errors).toContain("invalid_end_time");

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

  it("only assigns while a running experiment is within its time window", () => {
    expect(isExperimentActiveAt(experiment, "2026-09-26T00:00:00Z")).toBe(true);
    expect(
      isExperimentActiveAt(
        { ...experiment, status: "draft" },
        "2026-09-26T00:00:00Z",
      ),
    ).toBe(false);
    expect(
      isExperimentActiveAt(
        {
          ...experiment,
          startsAt: "2026-09-27T00:00:00Z",
        },
        "2026-09-26T00:00:00Z",
      ),
    ).toBe(false);
    expect(
      isExperimentActiveAt(
        {
          ...experiment,
          endsAt: "2026-09-25T23:59:59Z",
        },
        "2026-09-26T00:00:00Z",
      ),
    ).toBe(false);
  });

  it("rejects invalid experiment status", () => {
    expect(
      validateExperiment({
        ...experiment,
        status: "unknown" as ExperimentDefinition["status"],
      }).errors,
    ).toContain("invalid_status");
  });

  it("keeps assignment deterministic but workspace-scoped", () => {
    const first = assignExperimentVariant(experiment, "subject-42");
    const second = assignExperimentVariant(
      { ...experiment, workspaceId: "ws-2" },
      "subject-42",
    );
    expect(["control", "benefit"]).toContain(second.id);
    expect(first.id).toBe(
      assignExperimentVariant(
        { ...experiment, workspaceId: "ws-1" },
        "subject-42",
      ).id,
    );
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

  it("excludes unknown variants from observation evidence", () => {
    const summary = summarizeExperiment(experiment, [
      {
        experimentId: "exp-1",
        workspaceId: "ws-1",
        variantId: "unknown",
        subjectId: "u",
        observedAt: "2026-09-26T00:00:00Z",
        exposed: true,
        engaged: true,
        converted: true,
        value: 999,
      },
    ]);
    expect(summary.observationCount).toBe(0);
    expect(
      summary.variants.every((variant) => variant.exposureCount === 0),
    ).toBe(true);
  });

  it("attributes value only to exposed observations", () => {
    const summary = summarizeExperiment(experiment, [
      {
        experimentId: "exp-1",
        workspaceId: "ws-1",
        variantId: "control",
        subjectId: "hidden",
        observedAt: "2026-09-26T00:00:00Z",
        exposed: false,
        engaged: false,
        converted: false,
        value: 9999,
      },
      {
        experimentId: "exp-1",
        workspaceId: "ws-1",
        variantId: "benefit",
        subjectId: "exposed",
        observedAt: "2026-09-26T00:00:00Z",
        exposed: true,
        engaged: true,
        converted: false,
        value: 10,
      },
    ]);
    const control = summary.variants.find(
      (variant) => variant.variantId === "control",
    );
    const benefit = summary.variants.find(
      (variant) => variant.variantId === "benefit",
    );
    expect(control?.totalValue).toBe(0);
    expect(benefit?.totalValue).toBe(10);
    expect(observationsToLearningSignals(summary)).toContain(
      "value_leader:benefit:10.00",
    );
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

describe("experiment operating bindings and learning write-back", () => {
  const campaign = {
    id: "campaign-1",
    workspaceId: "ws-1",
    name: "Launch",
    status: "scheduled" as const,
    accountIds: ["account-1"],
    contentIds: ["content-a", "content-b"],
    taskCount: 0,
    createdAt: "2026-09-26T00:00:00Z",
  };

  it("compiles experiment variants into governed campaign work", () => {
    const boundExperiment: ExperimentDefinition = {
      ...experiment,
      variants: [
        {
          id: "control",
          name: "Control",
          allocationPercent: 50,
          contentId: "content-a",
        },
        {
          id: "benefit",
          name: "Benefit",
          allocationPercent: 50,
          contentId: "content-b",
        },
      ],
    };

    const plan = compileExperimentCampaignWorkPlan({
      experiment: boundExperiment,
      campaign,
    });

    expect(plan.binding).toEqual({
      experimentId: "exp-1",
      workspaceId: "ws-1",
      campaignId: "campaign-1",
      variants: [
        {
          variantId: "control",
          allocationPercent: 50,
          contentId: "content-a",
        },
        {
          variantId: "benefit",
          allocationPercent: 50,
          contentId: "content-b",
        },
      ],
    });
    expect(plan.steps.map((step) => step.kind)).toEqual([
      "assignment",
      "execution",
      "execution",
      "observation",
      "learning",
    ]);
    expect(plan.steps.every((step) => step.workspaceId === "ws-1")).toBe(true);
    expect(plan.steps.filter((step) => step.kind === "execution")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          variantId: "control",
          externallyVisible: true,
          requiresApproval: true,
        }),
        expect.objectContaining({
          variantId: "benefit",
          externallyVisible: true,
          requiresApproval: true,
        }),
      ]),
    );
    expect(plan.steps.at(-1)?.dependsOn).toEqual([
      "campaign-1:experiment:exp-1:observation",
    ]);
  });

  it("rejects cross-workspace and unattached experiment content", () => {
    expect(() =>
      compileExperimentCampaignWorkPlan({
        experiment,
        campaign: { ...campaign, workspaceId: "ws-2" },
      }),
    ).toThrow("experiment_campaign_workspace_mismatch");

    const contentBound: ExperimentDefinition = {
      ...experiment,
      variants: [
        {
          id: "control",
          name: "Control",
          allocationPercent: 50,
          contentId: "missing-content",
        },
        {
          id: "benefit",
          name: "Benefit",
          allocationPercent: 50,
          contentId: "content-b",
        },
      ],
    };
    expect(() =>
      compileExperimentCampaignWorkPlan({
        experiment: contentBound,
        campaign,
      }),
    ).toThrow("experiment_variant_content_not_attached_to_campaign");
  });

  it("rejects variants without unique delivery sources", () => {
    const noSource: ExperimentDefinition = {
      ...experiment,
      variants: [
        { id: "control", name: "Control", allocationPercent: 50 },
        { id: "benefit", name: "Benefit", allocationPercent: 50 },
      ],
    };
    expect(() =>
      compileExperimentCampaignWorkPlan({
        experiment: noSource,
        campaign,
      }),
    ).toThrow("experiment_variant_source_required");

    const duplicatedSource: ExperimentDefinition = {
      ...experiment,
      variants: [
        {
          id: "control",
          name: "Control",
          allocationPercent: 50,
          contentId: "content-a",
        },
        {
          id: "benefit",
          name: "Benefit",
          allocationPercent: 50,
          contentId: "content-a",
        },
      ],
    };
    expect(() =>
      compileExperimentCampaignWorkPlan({
        experiment: duplicatedSource,
        campaign,
      }),
    ).toThrow("experiment_variant_sources_must_be_unique");
  });

  it("builds descriptive learning write-back without statistical overclaiming", () => {
    const summary = summarizeExperiment(experiment, [
      {
        experimentId: "exp-1",
        workspaceId: "ws-1",
        variantId: "control",
        subjectId: "a",
        observedAt: "2026-09-26T00:00:00Z",
        exposed: true,
        engaged: false,
        converted: false,
        value: 5,
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
        value: 20,
      },
    ]);

    const writeback = buildExperimentLearningWriteback(
      experiment,
      summary,
      "2026-09-26T12:00:00Z",
    );

    expect(writeback.workspaceId).toBe("ws-1");
    expect(writeback.experimentId).toBe("exp-1");
    expect(writeback.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "conversion_observation",
          variantId: "benefit",
          metric: "conversion_rate",
          observedValue: 1,
        }),
        expect.objectContaining({
          kind: "value_observation",
          variantId: "benefit",
          metric: "observed_value",
          observedValue: 20,
        }),
      ]),
    );
    expect(writeback.insights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "learning",
          metric: "conversion_rate",
          confidence: 0,
          sourceIds: ["experiment:exp-1"],
        }),
        expect.objectContaining({
          kind: "learning",
          metric: "observed_value",
          confidence: 0,
          sourceIds: ["experiment:exp-1"],
        }),
      ]),
    );
    expect(
      writeback.insights.every((insight) =>
        insight.summary.includes("statistical significance is not claimed"),
      ),
    ).toBe(true);
  });

  it("writes no learning artifact when nothing was exposed", () => {
    const summary = summarizeExperiment(experiment, [
      {
        experimentId: "exp-1",
        workspaceId: "ws-1",
        variantId: "control",
        subjectId: "a",
        observedAt: "2026-09-26T00:00:00Z",
        exposed: false,
        engaged: false,
        converted: false,
        value: 100,
      },
    ]);

    const writeback = buildExperimentLearningWriteback(
      experiment,
      summary,
      "2026-09-26T12:00:00Z",
    );

    expect(writeback.insights).toEqual([]);
    expect(writeback.signals).toEqual([
      expect.objectContaining({
        kind: "insufficient_evidence",
      }),
    ]);
  });
});
