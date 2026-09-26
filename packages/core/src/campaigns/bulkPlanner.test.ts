import { describe, expect, it } from "vitest";
import { buildBulkPlan } from "./bulkPlanner.js";

describe("buildBulkPlan", () => {
  it("creates bounded scheduled items with stable idempotency keys", () => {
    const plan = buildBulkPlan({
      startAt: "2026-09-26T10:00:00Z",
      intervalMinutes: 30,
      count: 3,
      seed: "campaign-42",
    });

    expect(plan).toEqual([
      {
        index: 1,
        availableAt: "2026-09-26T10:00:00.000Z",
        idempotencyKey: "campaign-42-01",
      },
      {
        index: 2,
        availableAt: "2026-09-26T10:30:00.000Z",
        idempotencyKey: "campaign-42-02",
      },
      {
        index: 3,
        availableAt: "2026-09-26T11:00:00.000Z",
        idempotencyKey: "campaign-42-03",
      },
    ]);
  });

  it("rejects invalid ranges and dates", () => {
    expect(() =>
      buildBulkPlan({
        startAt: "2026-09-26T10:00:00Z",
        intervalMinutes: 0,
        count: 3,
      }),
    ).toThrow("intervalMinutes must be an integer");

    expect(() =>
      buildBulkPlan({
        startAt: "2026-09-26T10:00:00Z",
        intervalMinutes: 30,
        count: 51,
      }),
    ).toThrow("count must be an integer");

    expect(() =>
      buildBulkPlan({
        startAt: "not-a-date",
        intervalMinutes: 30,
        count: 1,
      }),
    ).toThrow("startAt must be a valid date-time");
  });
});
