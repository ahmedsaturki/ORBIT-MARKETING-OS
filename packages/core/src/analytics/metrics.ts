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
  campaignId?: string,
): CampaignMetrics {
  const scoped = campaignId === undefined
    ? events
    : events.filter((event) => event.campaignId === campaignId);
  const attempted = scoped.length;
  const succeeded = scoped.filter((event) => event.status === "succeeded").length;
  const failed = scoped.filter((event) => event.status === "failed").length;
  const blocked = scoped.filter((event) => event.status === "blocked").length;
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
