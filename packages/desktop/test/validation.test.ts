import { describe, expect, it } from "vitest";
import { validateAccountForm } from "../src/lib/validation";

describe("validateAccountForm", () => {
  it("accepts a supported account", () => {
    expect(validateAccountForm({
      id: "fb-main",
      platform: "facebook",
      displayName: "Main Page",
    })).toEqual([]);
  });

  it("rejects unsupported or malformed input", () => {
    expect(validateAccountForm({
      id: "",
      platform: "unknown",
      displayName: "",
    })).toEqual(["invalid id", "unsupported platform", "invalid display name"]);
  });
});
