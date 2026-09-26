export interface BulkPlanItem {
  readonly index: number;
  readonly availableAt: string;
  readonly idempotencyKey: string;
}

export interface BulkPlanInput {
  readonly startAt: string;
  readonly intervalMinutes: number;
  readonly count: number;
  readonly seed?: string;
}

function assertPositiveInteger(
  value: number,
  field: string,
  max: number,
): void {
  if (!Number.isInteger(value) || value < 1 || value > max) {
    throw new RangeError(`${field} must be an integer between 1 and ${max}`);
  }
}

/**
 * Build a deterministic queue plan for bulk publishing.
 *
 * This function performs no I/O and does not execute connectors. The caller
 * remains responsible for authorization, approval, policy evaluation, and
 * enqueueing through the canonical task queue.
 */
export function buildBulkPlan(input: BulkPlanInput): readonly BulkPlanItem[] {
  assertPositiveInteger(input.intervalMinutes, "intervalMinutes", 7 * 24 * 60);
  assertPositiveInteger(input.count, "count", 50);

  const start = new Date(input.startAt);
  if (Number.isNaN(start.getTime())) {
    throw new Error("startAt must be a valid date-time");
  }

  const seed = input.seed?.trim() || `bulk-${start.getTime()}`;

  return Array.from({ length: input.count }, (_, index) => ({
    index: index + 1,
    availableAt: new Date(
      start.getTime() + index * input.intervalMinutes * 60_000,
    ).toISOString(),
    idempotencyKey: `${seed}-${String(index + 1).padStart(2, "0")}`,
  }));
}
