export interface MetricPoint {
  readonly timestamp: string;
  readonly value: number;
}

export interface CampaignMetrics {
  readonly attempted: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly blocked: number;
  readonly completionRate: number;
  readonly successRate: number;
  readonly failureRate: number;
}

export interface AnalyticsEvent {
  readonly campaignId: string;
  readonly status: "succeeded" | "failed" | "blocked";
  readonly timestamp: string;
}

export function aggregateCampaignMetrics(
  events: readonly AnalyticsEvent[],
): CampaignMetrics {
  const attempted = events.length;
  const succeeded = events.filter((event) => event.status === "succeeded").length;
  const failed = events.filter((event) => event.status === "failed").length;
  const blocked = events.filter((event) => event.status === "blocked").length;
  const completed = succeeded + failed + blocked;
  return {
    attempted,
    succeeded,
    failed,
    blocked,
    completionRate: attempted === 0 ? 0 : completed / attempted,
    successRate: attempted === 0 ? 0 : succeeded / attempted,
    failureRate: attempted === 0 ? 0 : failed / attempted,
  };
}

export function buildMetricSeries(
  points: readonly MetricPoint[],
): readonly MetricPoint[] {
  return [...points]
    .filter((point) => Number.isFinite(point.value) && !Number.isNaN(Date.parse(point.timestamp)))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map((point) => ({ ...point }));
}
