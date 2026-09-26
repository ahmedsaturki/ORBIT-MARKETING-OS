import { describe, expect, it } from "vitest";
import { buildEvidenceReportingPack } from "./pack.js";

const evidence = [
  {
    id: "ev-1",
    sourceType: "analytics_event" as const,
    sourceId: "evt-1",
    observedAt: "2026-09-26T10:00:00Z",
    statement: "Campaign completed successfully.",
  },
];

describe("evidence reporting packs", () => {
  it("builds a normalized pack with traceable metrics", () => {
    const pack = buildEvidenceReportingPack({
      id: "report-1",
      title: "Campaign report",
      periodStart: "2026-09-01T00:00:00Z",
      periodEnd: "2026-09-26T00:00:00Z",
      generatedAt: "2026-09-26T12:00:00Z",
      metrics: [
        {
          key: "success_rate",
          label: "Success rate",
          value: 0.9,
          unit: "ratio",
          evidenceIds: ["ev-1"],
        },
      ],
      insights: ["Operational reliability improved."],
      evidence,
    });
    expect(pack.periodStart).toBe("2026-09-01T00:00:00.000Z");
    expect(pack.metrics[0]?.evidenceIds).toEqual(["ev-1"]);
  });

  it("rejects metrics without evidence", () => {
    expect(() =>
      buildEvidenceReportingPack({
        id: "report-2",
        title: "Invalid",
        periodStart: "2026-09-01T00:00:00Z",
        periodEnd: "2026-09-26T00:00:00Z",
        generatedAt: "2026-09-26T12:00:00Z",
        metrics: [
          {
            key: "success_rate",
            label: "Success rate",
            value: 0.9,
            unit: "ratio",
            evidenceIds: [],
          },
        ],
        evidence,
      }),
    ).toThrow("requires evidence");
  });

  it("rejects currency metrics without a currency", () => {
    expect(() =>
      buildEvidenceReportingPack({
        id: "report-3",
        title: "Invalid currency",
        periodStart: "2026-09-01T00:00:00Z",
        periodEnd: "2026-09-26T00:00:00Z",
        generatedAt: "2026-09-26T12:00:00Z",
        metrics: [
          {
            key: "revenue",
            label: "Revenue",
            value: 100,
            unit: "currency",
            evidenceIds: ["ev-1"],
          },
        ],
        evidence,
      }),
    ).toThrow("requires currency");
  });

  it("rejects missing evidence references and invalid periods", () => {
    expect(() =>
      buildEvidenceReportingPack({
        id: "report-4",
        title: "Invalid evidence",
        periodStart: "2026-09-26T00:00:00Z",
        periodEnd: "2026-09-25T00:00:00Z",
        generatedAt: "2026-09-26T12:00:00Z",
        metrics: [
          {
            key: "attempted",
            label: "Attempted",
            value: 1,
            unit: "count",
            evidenceIds: ["missing"],
          },
        ],
        evidence,
      }),
    ).toThrow("periodEnd must not be before periodStart");
  });

  it("rejects invalid evidence timestamps and blank statements", () => {
    expect(() =>
      buildEvidenceReportingPack({
        id: "report-5",
        title: "Invalid evidence",
        periodStart: "2026-09-01T00:00:00Z",
        periodEnd: "2026-09-26T00:00:00Z",
        generatedAt: "2026-09-26T12:00:00Z",
        metrics: [],
        evidence: [
          { ...evidence[0], observedAt: "invalid" },
        ],
      }),
    ).toThrow("observedAt must be a valid date");

    expect(() =>
      buildEvidenceReportingPack({
        id: "report-6",
        title: "Invalid statement",
        periodStart: "2026-09-01T00:00:00Z",
        periodEnd: "2026-09-26T00:00:00Z",
        generatedAt: "2026-09-26T12:00:00Z",
        metrics: [],
        evidence: [
          { ...evidence[0], statement: "   " },
        ],
      }),
    ).toThrow("statement is required");
  });
});
