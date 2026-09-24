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

  it("does not mix metrics from different campaigns", () => {
    const metrics = aggregateCampaignMetrics(
      [
        { campaignId: "c1", status: "succeeded", timestamp: "2026-09-24T01:00:00.000Z" },
        { campaignId: "c2", status: "failed", timestamp: "2026-09-24T02:00:00.000Z" },
      ],
      "c1",
    );
    expect(metrics.attempted).toBe(1);
    expect(metrics.succeeded).toBe(1);
    expect(metrics.failed).toBe(0);
  });

  it("sorts metric points by instant rather than timestamp text", () => {
    const series = buildMetricSeries([
      { timestamp: "2026-09-24T03:00:00+03:00", value: 3 },
      { timestamp: "2026-09-24T00:30:00Z", value: 2 },
      { timestamp: "2026-09-24T01:00:00Z", value: 4 },
    ]);

    expect(series.map((point) => point.value)).toEqual([2, 3, 4]);
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
