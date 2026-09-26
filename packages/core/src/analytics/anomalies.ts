import { buildMetricSeries, type MetricPoint } from "./metrics.js";

export type AnomalyDirection = "spike" | "drop";

export interface MetricAnomaly {
  readonly metric: string;
  readonly timestamp: string;
  readonly value: number;
  readonly baselineMedian: number;
  readonly baselineMad: number;
  readonly absoluteDelta: number;
  readonly direction: AnomalyDirection;
  readonly modifiedZScore: number | null;
  readonly method: "rolling_median_mad";
  readonly interpretation: "descriptive_anomaly_signal";
}

export interface AnomalyDetectionOptions {
  readonly windowSize?: number;
  readonly threshold?: number;
  readonly minAbsoluteDelta?: number;
  readonly maxResults?: number;
}

function median(values: readonly number[]): number {
  if (values.length === 0) {
    throw new Error("median_requires_values");
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1]! + sorted[middle]!) / 2;
  }
  return sorted[middle]!;
}

function classifyAnomaly(
  value: number,
  baselineMedian: number,
  baselineMad: number,
  threshold: number,
): { isAnomaly: boolean; modifiedZScore: number | null } {
  if (baselineMad === 0) {
    return {
      isAnomaly: value !== baselineMedian,
      modifiedZScore: null,
    };
  }
  const modifiedZScore = (0.67448975 * (value - baselineMedian)) / baselineMad;
  return {
    isAnomaly: Math.abs(modifiedZScore) >= threshold,
    modifiedZScore,
  };
}

function assertOption(condition: boolean, errorCode: string): void {
  if (!condition) throw new Error(errorCode);
}

function normalizedOptions(
  options: AnomalyDetectionOptions,
): Required<AnomalyDetectionOptions> {
  const windowSize = options.windowSize ?? 7;
  const threshold = options.threshold ?? 3.5;
  const minAbsoluteDelta = options.minAbsoluteDelta ?? 0;
  const maxResults = options.maxResults ?? 50;

  assertOption(
    Number.isInteger(windowSize) && windowSize >= 3 && windowSize <= 365,
    "anomaly_window_invalid",
  );
  assertOption(
    Number.isFinite(threshold) && threshold > 0 && threshold <= 100,
    "anomaly_threshold_invalid",
  );
  assertOption(
    Number.isFinite(minAbsoluteDelta) && minAbsoluteDelta >= 0,
    "anomaly_min_absolute_delta_invalid",
  );
  assertOption(
    Number.isInteger(maxResults) && maxResults >= 1 && maxResults <= 1000,
    "anomaly_max_results_invalid",
  );

  return { windowSize, threshold, minAbsoluteDelta, maxResults };
}

/**
 * Detects point anomalies against a preceding rolling baseline.
 *
 * The baseline never includes the point being classified or any future points.
 * This is intentionally descriptive: it does not claim causality, significance,
 * forecast accuracy, or platform-wide behavior.
 */
export function detectMetricAnomalies(
  metric: string,
  points: readonly MetricPoint[],
  options: AnomalyDetectionOptions = {},
): readonly MetricAnomaly[] {
  if (!metric.trim()) {
    throw new Error("anomaly_metric_required");
  }
  const config = normalizedOptions(options);
  const ordered = buildMetricSeries(points);
  const anomalies: MetricAnomaly[] = [];
  for (let index = config.windowSize; index < ordered.length; index += 1) {
    const current = ordered[index]!;
    const baselineValues = ordered
      .slice(index - config.windowSize, index)
      .map((point) => point.value);
    const baselineMedian = median(baselineValues);
    const baselineMad = median(
      baselineValues.map((value) => Math.abs(value - baselineMedian)),
    );
    const absoluteDelta = Math.abs(current.value - baselineMedian);
    if (absoluteDelta < config.minAbsoluteDelta) {
      continue;
    }
    const classification = classifyAnomaly(
      current.value,
      baselineMedian,
      baselineMad,
      config.threshold,
    );
    if (!classification.isAnomaly) {
      continue;
    }
    anomalies.push({
      metric,
      timestamp: current.timestamp,
      value: current.value,
      baselineMedian,
      baselineMad,
      absoluteDelta,
      direction: current.value >= baselineMedian ? "spike" : "drop",
      modifiedZScore: classification.modifiedZScore,
      method: "rolling_median_mad",
      interpretation: "descriptive_anomaly_signal",
    });
  }
  return anomalies
    .sort(
      (left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp),
    )
    .slice(0, config.maxResults)
    .map((anomaly) => ({ ...anomaly }));
}
