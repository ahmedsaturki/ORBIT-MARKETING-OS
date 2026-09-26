import { describe, expect, it } from "vitest";
import { buildAnomalyInsights, detectMetricAnomalies } from "./anomalies.js";

const series = Array.from({ length: 9 }, (_, index) => ({
  timestamp: `2026-09-${String(index + 1).padStart(2, "0")}T00:00:00Z`,
  value: index === 8 ? 30 : 10,
}));

describe("deterministic anomaly detection", () => {
  it("detects a spike against a preceding rolling median", () => {
    const anomalies = detectMetricAnomalies("engagement_rate", series, {
      windowSize: 5,
    });

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]).toMatchObject({
      metric: "engagement_rate",
      value: 30,
      baselineMedian: 10,
      direction: "spike",
      method: "rolling_median_mad",
      interpretation: "descriptive_anomaly_signal",
    });
    expect(anomalies[0]?.modifiedZScore).toBeNull();
  });

  it("detects drops without using future observations", () => {
    const points = [
      ...series.slice(0, 8),
      { timestamp: "2026-09-09T00:00:00Z", value: 0 },
      { timestamp: "2026-09-10T00:00:00Z", value: 10 },
    ];
    const anomalies = detectMetricAnomalies("conversion_rate", points, {
      windowSize: 5,
    });

    expect(anomalies[0]).toMatchObject({
      value: 0,
      direction: "drop",
    });
  });

  it("is deterministic and bounded", () => {
    const forward = detectMetricAnomalies("metric", series, {
      windowSize: 5,
      maxResults: 1,
    });
    const reverse = detectMetricAnomalies("metric", [...series].reverse(), {
      windowSize: 5,
      maxResults: 1,
    });

    expect(reverse).toEqual(forward);
  });

  it("rejects invalid configuration and follows canonical metric filtering", () => {
    expect(() =>
      detectMetricAnomalies("metric", series, { windowSize: 2 }),
    ).toThrow("anomaly_window_invalid");
    expect(() =>
      detectMetricAnomalies("metric", series, { threshold: 0 }),
    ).toThrow("anomaly_threshold_invalid");
    expect(
      detectMetricAnomalies("metric", [{ timestamp: "bad", value: 1 }]),
    ).toEqual([]);
  });

  it("builds evidence-oriented anomaly insights without fake confidence", () => {
    const anomalies = detectMetricAnomalies("metric", series, {
      windowSize: 5,
    });
    const insights = buildAnomalyInsights(
      "ws-1",
      anomalies,
      "2026-09-10T00:00:00Z",
    );

    expect(insights).toHaveLength(1);
    expect(insights[0]).toMatchObject({
      workspaceId: "ws-1",
      kind: "anomaly",
      metric: "metric",
      confidence: 0,
    });
    expect(insights[0]?.summary).toContain(
      "statistical significance are not claimed",
    );
  });
});
