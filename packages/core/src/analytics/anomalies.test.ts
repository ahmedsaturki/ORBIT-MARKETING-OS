import { describe, expect, it } from "vitest";
import { buildAnomalyInsights, detectMetricAnomalies } from "./anomalies.js";

const series = Array.from({ length: 9 }, (_, index) => ({
  timestamp: `2026-09-${String(index + 1).padStart(2, "0")}T00:00:00Z`,
  value: index === 8 ? 30 : 10,
}));

describe("deterministic anomaly detection", () => {
  it("detects a constant-baseline spike", () => {
    expect(detectMetricAnomalies("engagement_rate", series, { windowSize: 5 })).toMatchObject([
      {
        value: 30,
        baselineMedian: 10,
        direction: "spike",
        modifiedZScore: null,
        method: "rolling_median_mad",
      },
    ]);
  });

  it("detects a drop from preceding observations without future leakage", () => {
    const points = [
      ...series.slice(0, 8),
      { timestamp: "2026-09-09T00:00:00Z", value: 0 },
      { timestamp: "2026-09-10T00:00:00Z", value: 10 },
    ];
    const anomalies = detectMetricAnomalies("conversion_rate", points, {
      windowSize: 5,
    });

    expect(anomalies[0]).toMatchObject({ value: 0, direction: "drop" });
    expect(detectMetricAnomalies("conversion_rate", points.slice(0, 9), {
      windowSize: 5,
    })).toHaveLength(1);
  });

  it("is deterministic, bounded, and emits descriptive evidence", () => {
    const reverse = detectMetricAnomalies("metric", [...series].reverse(), {
      windowSize: 5,
      maxResults: 1,
    });
    const forward = detectMetricAnomalies("metric", series, {
      windowSize: 5,
      maxResults: 1,
    });
    const insights = buildAnomalyInsights(
      "ws-1",
      forward,
      "2026-09-10T00:00:00Z",
    );

    expect(reverse).toEqual(forward);
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
