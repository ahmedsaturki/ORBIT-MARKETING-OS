import { describe, expect, it } from "vitest";
import {
  aggregateCampaignMetrics,
  buildMetricSeries,
} from "../src/analytics/metrics.js";

describe("analytics primitives", () => {
  it("aggregates execution outcomes", () => {
    const metrics = aggregateCampaignMetrics([
      {
        campaignId: "c1",
        status: "succeeded",
        timestamp: "2026-09-24T01:00:00.000Z",
      },
      {
        campaignId: "c1",
        status: "failed",
        timestamp: "2026-09-24T02:00:00.000Z",
      },
      {
        campaignId: "c1",
        status: "blocked",
        timestamp: "2026-09-24T03:00:00.000Z",
      },
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
        {
          campaignId: "c1",
          status: "succeeded",
          timestamp: "2026-09-24T01:00:00.000Z",
        },
        {
          campaignId: "c2",
          status: "failed",
          timestamp: "2026-09-24T02:00:00.000Z",
        },
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

    expect(series.map((point) => point.value)).toEqual([3, 2, 4]);
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


describe("metric anomaly detection", () => {
  const series = Array.from({ length: 9 }, (_, index) => ({
    timestamp: `2026-09-${String(index + 1).padStart(2, "0")}T00:00:00Z`,
    value: index === 8 ? 30 : 10,
  }));

  it("detects constant-baseline spikes and preceding-window drops", () => {
    expect(
      detectMetricAnomalies("engagement_rate", series, { windowSize: 5 }),
    ).toMatchObject([
      { value: 30, baselineMedian: 10, direction: "spike" },
    ]);

    const points = [
      ...series.slice(0, 8),
      { timestamp: "2026-09-09T00:00:00Z", value: 0 },
      { timestamp: "2026-09-10T00:00:00Z", value: 10 },
    ];
    expect(
      detectMetricAnomalies("conversion_rate", points, { windowSize: 5 })[0],
    ).toMatchObject({ value: 0, direction: "drop" });
  });

  it("is deterministic, bounded, descriptive, and rejects invalid config", () => {
    const forward = detectMetricAnomalies("metric", series, {
      windowSize: 5,
      maxResults: 1,
    });
    expect(
      detectMetricAnomalies("metric", [...series].reverse(), {
        windowSize: 5,
        maxResults: 1,
      }),
    ).toEqual(forward);

    const insights = buildAnomalyInsights(
      "ws-1",
      forward,
      "2026-09-10T00:00:00Z",
    );
    expect(insights[0]).toMatchObject({
      workspaceId: "ws-1",
      kind: "anomaly",
      confidence: 0,
    });
    expect(insights[0]?.summary).toContain(
      "statistical significance are not claimed",
    );
    expect(() =>
      detectMetricAnomalies("metric", series, { windowSize: 2 }),
    ).toThrow("anomaly_window_invalid");
  });
});
