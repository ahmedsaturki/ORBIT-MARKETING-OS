export interface ReportingEvidence {
  readonly id: string;
  readonly sourceType: "analytics_event" | "insight" | "outcome" | "research" | "manual";
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

export function buildEvidenceReportingPack(
  input: {
    readonly id: string;
    readonly title: string;
    readonly periodStart: string;
    readonly periodEnd: string;
    readonly generatedAt: string;
    readonly metrics: readonly ReportingMetric[];
    readonly insights?: readonly string[];
    readonly evidence: readonly ReportingEvidence[];
  },
): ReportingPack {
  const start = assertDate(input.periodStart, "periodStart");
  const end = assertDate(input.periodEnd, "periodEnd");
  const generated = assertDate(input.generatedAt, "generatedAt");
  if (end.getTime() < start.getTime()) {
    throw new Error("periodEnd must not be before periodStart");
  }

  const evidenceIds = new Set(input.evidence.map((item) => item.id));
  for (const metric of input.metrics) {
    if (!Number.isFinite(metric.value)) {
      throw new Error(`metric ${metric.key} value must be finite`);
    }
    if (metric.unit === "currency" && !metric.currency) {
      throw new Error(`metric ${metric.key} requires currency`);
    }
    for (const id of metric.evidenceIds) {
      if (!evidenceIds.has(id)) {
        throw new Error(`metric ${metric.key} references missing evidence ${id}`);
      }
    }
    if (metric.evidenceIds.length === 0) {
      throw new Error(`metric ${metric.key} requires evidence`);
    }
  }

  for (const item of input.evidence) {
    assertDate(item.observedAt, `evidence ${item.id} observedAt`);
    if (!item.statement.trim()) {
      throw new Error(`evidence ${item.id} statement is required`);
    }
  }

  return {
    id: input.id,
    title: input.title,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    generatedAt: generated.toISOString(),
    metrics: input.metrics.map((metric) => ({ ...metric })),
    insights: [...(input.insights ?? [])],
    evidence: input.evidence.map((item) => ({ ...item })),
  };
}
