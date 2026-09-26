import { describe, expect, it } from "vitest";
import { buildEvidenceReportingPack } from "./pack.js";

const evidence = [
  {
    id: "ev-1",
    workspaceId: "workspace-001",
    sourceType: "analytics_event" as const,
    sourceId: "evt-1",
    observedAt: "2026-09-26T10:00:00Z",
    statement: "Campaign completed successfully.",
  },
];

const base = {
  id: "report-1",
  workspaceId: "workspace-001",
  title: "Campaign report",
  periodStart: "2026-09-01T00:00:00Z",
  periodEnd: "2026-09-26T23:59:59Z",
  generatedAt: "2026-09-26T12:00:00Z",
};

describe("evidence reporting packs", () => {
  it("builds a normalized pack with traceable metrics", () => {
    const pack = buildEvidenceReportingPack({
      ...base,
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
    expect(pack.workspaceId).toBe("workspace-001");
    expect(pack.periodStart).toBe("2026-09-01T00:00:00.000Z");
    expect(pack.metrics[0]?.evidenceIds).toEqual(["ev-1"]);
  });

  it("rejects metrics without evidence", () => {
    expect(() =>
      buildEvidenceReportingPack({
        ...base,
        metrics: [
          {
            key: "success_rate",
            label: "Success rate",
            value: 0.9,
            unit: "ratio",
            evidenceIds: [],
          },
        ],
        evidence: [],
      }),
    ).toThrow("requires evidence");
  });

  it("rejects currency metrics without a valid currency", () => {
    for (const currency of [undefined, "usd", "US", "USDD"]) {
      expect(() =>
        buildEvidenceReportingPack({
          ...base,
          metrics: [
            {
              key: "revenue",
              label: "Revenue",
              value: 100,
              unit: "currency",
              currency,
              evidenceIds: ["ev-1"],
            },
          ],
          evidence,
        }),
      ).toThrow("requires a three-letter uppercase currency");
    }
  });

  it("rejects invalid ratio and count values", () => {
    expect(() =>
      buildEvidenceReportingPack({
        ...base,
        metrics: [
          {
            key: "ratio",
            label: "Ratio",
            value: 1.1,
            unit: "ratio",
            evidenceIds: ["ev-1"],
          },
        ],
        evidence,
      }),
    ).toThrow("ratio must be between 0 and 1");

    expect(() =>
      buildEvidenceReportingPack({
        ...base,
        metrics: [
          {
            key: "count",
            label: "Count",
            value: -1,
            unit: "count",
            evidenceIds: ["ev-1"],
          },
        ],
        evidence,
      }),
    ).toThrow("count cannot be negative");
  });

  it("rejects missing evidence references and invalid periods", () => {
    expect(() =>
      buildEvidenceReportingPack({
        ...base,
        periodStart: "2026-09-26T00:00:00Z",
        periodEnd: "2026-09-25T00:00:00Z",
        metrics: [],
        evidence: [],
      }),
    ).toThrow("periodEnd must not be before periodStart");

    expect(() =>
      buildEvidenceReportingPack({
        ...base,
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
    ).toThrow("references missing evidence");
  });

  it("rejects invalid evidence timestamps, blank statements, and future evidence", () => {
    expect(() =>
      buildEvidenceReportingPack({
        ...base,
        metrics: [],
        evidence: [{ ...evidence[0], observedAt: "invalid" }],
      }),
    ).toThrow("observedAt must be a valid date");

    expect(() =>
      buildEvidenceReportingPack({
        ...base,
        metrics: [],
        evidence: [{ ...evidence[0], statement: "   " }],
      }),
    ).toThrow("statement is required");

    expect(() =>
      buildEvidenceReportingPack({
        ...base,
        metrics: [],
        evidence: [
          {
            ...evidence[0],
            observedAt: "2026-09-26T13:00:01Z",
          },
        ],
      }),
    ).toThrow("cannot be observed after generatedAt");
  });

  it("rejects cross-workspace evidence and evidence outside metric period", () => {
    expect(() =>
      buildEvidenceReportingPack({
        ...base,
        metrics: [],
        evidence: [
          {
            ...evidence[0],
            workspaceId: "workspace-002",
          },
        ],
      }),
    ).toThrow("workspace does not match report workspace");

    expect(() =>
      buildEvidenceReportingPack({
        ...base,
        periodStart: "2026-09-01T00:00:00Z",
        periodEnd: "2026-09-20T00:00:00Z",
        metrics: [
          {
            key: "attempted",
            label: "Attempted",
            value: 1,
            unit: "count",
            evidenceIds: ["ev-1"],
          },
        ],
        evidence,
      }),
    ).toThrow("outside reporting period");
  });

  it("rejects blank report identity fields", () => {
    expect(() =>
      buildEvidenceReportingPack({
        ...base,
        workspaceId: " ",
        metrics: [],
        evidence: [],
      }),
    ).toThrow("workspaceId is required");

    expect(() =>
      buildEvidenceReportingPack({
        ...base,
        title: " ",
        metrics: [],
        evidence: [],
      }),
    ).toThrow("title is required");
  });
});
