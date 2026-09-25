import { describe, expect, it } from "vitest";
import { validateInsight, validateOpportunity } from "./index.js";

describe("outcome contracts", () => {
  it("accepts a valid marketing opportunity", () => {
    expect(
      validateOpportunity({
        id: "opp-1",
        workspaceId: "ws-1",
        contactId: "contact-1",
        name: "Qualified deal",
        stage: "qualified",
        value: 1000,
        currency: "USD",
        probability: 50,
        createdAt: "2026-09-25T00:00:00Z",
        updatedAt: "2026-09-25T00:00:00Z",
      }),
    ).toEqual([]);
  });

  it("rejects unsafe opportunity values", () => {
    const errors = validateOpportunity({
      id: "opp-1",
      workspaceId: "ws-1",
      contactId: "contact-1",
      name: "Bad deal",
      stage: "qualified",
      value: -1,
      currency: "US",
      probability: 101,
      createdAt: "2026-09-25T00:00:00Z",
      updatedAt: "2026-09-25T00:00:00Z",
    });
    expect(errors).toEqual([
      "invalid_value",
      "invalid_currency",
      "invalid_probability",
    ]);
  });

  it("requires grounded evidence for insights", () => {
    const errors = validateInsight({
      id: "insight-1",
      workspaceId: "ws-1",
      kind: "learning",
      title: "Learning",
      summary: "A grounded observation",
      confidence: 0.9,
      sourceIds: ["analytics-1"],
      observedAt: "2026-09-25T00:00:00Z",
      createdAt: "2026-09-25T00:00:00Z",
      updatedAt: "2026-09-25T00:00:00Z",
    });
    expect(errors).toEqual([]);
  });
});
