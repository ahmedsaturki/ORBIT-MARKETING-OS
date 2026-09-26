export interface ReportingEvidence {
  readonly id: string;
  readonly workspaceId: string;
  readonly sourceType:
    "analytics_event" | "insight" | "outcome" | "research" | "manual";
  readonly sourceId: string;
  readonly observedAt: string;
  readonly statement: string;
}

export interface ReportingMetric {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  readonly unit: "count" | "ratio" | "currency";
  readonly currency?: string;
  readonly evidenceIds: readonly string[];
}

export interface ReportingPack {
  readonly id: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly generatedAt: string;
  readonly metrics: readonly ReportingMetric[];
  readonly insights: readonly string[];
  readonly evidence: readonly ReportingEvidence[];
}

function assertDate(value: string, field: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(field + " must be a valid date");
  }
  return date;
}

function assertMetricValue(metric: ReportingMetric): void {
  if (!Number.isFinite(metric.value)) {
    throw new Error(`metric ${metric.key} value must be finite`);
  }
  if (!metric.label.trim()) {
    throw new Error(`metric ${metric.key} label is required`);
  }
  if (metric.unit === "count" && metric.value < 0) {
    throw new Error(`metric ${metric.key} count cannot be negative`);
  }
  if (metric.unit === "ratio" && (metric.value < 0 || metric.value > 1)) {
    throw new Error(`metric ${metric.key} ratio must be between 0 and 1`);
  }
  if (metric.unit === "currency") {
    if (!metric.currency || !/^[A-Z]{3}$/.test(metric.currency)) {
      throw new Error(
        `metric ${metric.key} requires a three-letter uppercase currency`,
      );
    }
  }
}

export function buildEvidenceReportingPack(input: {
  readonly id: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly generatedAt: string;
  readonly metrics: readonly ReportingMetric[];
  readonly insights?: readonly string[];
  readonly evidence: readonly ReportingEvidence[];
}): ReportingPack {
  if (!input.workspaceId.trim()) {
    throw new Error("workspaceId is required");
  }
  if (!input.title.trim()) {
    throw new Error("title is required");
  }

  const start = assertDate(input.periodStart, "periodStart");
  const end = assertDate(input.periodEnd, "periodEnd");
  const generated = assertDate(input.generatedAt, "generatedAt");
  if (end.getTime() < start.getTime()) {
    throw new Error("periodEnd must not be before periodStart");
  }

  const evidenceIds = new Set<string>();
  const evidenceById = new Map<string, ReportingEvidence>();

  for (const item of input.evidence) {
    if (evidenceIds.has(item.id)) {
      throw new Error(`duplicate evidence id ${item.id}`);
    }
    if (item.workspaceId !== input.workspaceId) {
      throw new Error(
        `evidence ${item.id} workspace does not match report workspace`,
      );
    }
    const observedAt = assertDate(
      item.observedAt,
      `evidence ${item.id} observedAt`,
    );
    if (!item.statement.trim()) {
      throw new Error(`evidence ${item.id} statement is required`);
    }
    evidenceIds.add(item.id);
    evidenceById.set(item.id, item);
    if (observedAt.getTime() > generated.getTime()) {
      throw new Error(
        `evidence ${item.id} cannot be observed after generatedAt`,
      );
    }
  }

  for (const metric of input.metrics) {
    assertMetricValue(metric);
    if (metric.evidenceIds.length === 0) {
      throw new Error(`metric ${metric.key} requires evidence`);
    }
    for (const id of metric.evidenceIds) {
      const item = evidenceById.get(id);
      if (!item) {
        throw new Error(
          `metric ${metric.key} references missing evidence ${id}`,
        );
      }
      const observedAt = new Date(item.observedAt);
      if (
        observedAt.getTime() < start.getTime() ||
        observedAt.getTime() > end.getTime()
      ) {
        throw new Error(
          `metric ${metric.key} references evidence outside reporting period`,
        );
      }
    }
  }

  return {
    id: input.id,
    workspaceId: input.workspaceId,
    title: input.title,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    generatedAt: generated.toISOString(),
    metrics: input.metrics.map((metric) => ({ ...metric })),
    insights: [...(input.insights ?? [])],
    evidence: input.evidence.map((item) => ({ ...item })),
  };
}
