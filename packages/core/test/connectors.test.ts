import { describe, expect, it } from "vitest";
import { assertUserConfirmed } from "../src/connectors/contracts.js";

describe("connector authorization boundary", () => {
  it("rejects externally-visible actions without explicit confirmation", () => {
    expect(() =>
      assertUserConfirmed({
        accountId: "acc-1",
        userConfirmed: false,
      }),
    ).toThrow("Explicit user confirmation is required");
  });

  it("accepts an explicitly confirmed action", () => {
    expect(() =>
      assertUserConfirmed({
        accountId: "acc-1",
        userConfirmed: true,
      }),
    ).not.toThrow();
  });
});
