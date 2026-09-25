import { describe, expect, it } from "vitest";
import { handleChallenge } from "../src/connectors/index.js";

describe("challenge safe stop", () => {
  it("reports a clean page as non-intervention", () => {
    expect(
      handleChallenge({ kind: "unknown_checkpoint", detected: false }),
    ).toEqual({
      ok: false,
      error: "no_challenge",
      requiresIntervention: false,
    });
  });

  it("requires intervention when a challenge is detected", () => {
    const result = handleChallenge({
      kind: "captcha",
      detected: true,
      selectorHint: "iframe[src*=captcha]",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.requiresIntervention).toBe(true);
      expect(result.error).toContain("automation stopped safely");
    }
  });
});
