import { describe, expect, it } from "vitest";
import { aggregateCampaignMetrics, buildMetricSeries } from "../src/analytics/metrics.js";

describe("analytics primitives", () => {
  it("aggregates execution outcomes", () => {
    const metrics = aggregateCampaignMetrics([
      { campaignId: "c1", status: "succeeded", timestamp: "2026-09-24T01:00:00.000Z" },
      { campaignId: "c1", status: "failed", timestamp: "2026-09-24T02:00:00.000Z" },
      { campaignId: "c1", status: "blocked", timestamp: "2026-09-24T03:00:00.000Z" },
    ]);
    expect(metrics).toMatchObject({
      attempted: 3,
      succeeded: 1,
      failed: 1,
      blocked: 1,
    });
    expect(metrics.completionRate).toBe(1);
    expect(metrics.successRate).toBeCloseTo(1 / 3);
    expect(metrics.failureRate).toBeCloseTo(1 / 3);
  });

  it("sorts and filters metric points deterministically", () => {
    const series = buildMetricSeries([
      { timestamp: "2026-09-24T03:00:00.000Z", value: 3 },
      { timestamp: "bad", value: 100 },
      { timestamp: "2026-09-24T01:00:00.000Z", value: Number.NaN },
      { timestamp: "2026-09-24T02:00:00.000Z", value: 2 },
    ]);
    expect(series).toEqual([
      { timestamp: "2026-09-24T02:00:00.000Z", value: 2 },
      { timestamp: "2026-09-24T03:00:00.000Z", value: 3 },
    ]);
  });
});
