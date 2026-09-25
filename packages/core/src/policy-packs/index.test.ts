import { describe, expect, it } from "vitest";
import {
  BUILT_IN_POLICY_PACKS,
  getPolicyPack,
  materializePolicyPack,
} from "./index.js";

describe("policy packs", () => {
  it("provides named governed presets with explicit safety blocks", () => {
    expect(BUILT_IN_POLICY_PACKS).toHaveLength(5);
    expect(
      getPolicyPack("regulated").policy.blockedActions,
    ).toContain("captcha_bypass");
  });

  it("materializes a workspace-bound policy", () => {
    expect(materializePolicyPack("balanced", "ws-1", "policy-1")).toEqual(
      expect.objectContaining({
        id: "policy-1",
        workspaceId: "ws-1",
        mode: "bounded",
        maxDailyExternalActions: 25,
      }),
    );
  });

  it("rejects missing identities", () => {
    expect(() =>
      materializePolicyPack("balanced", "", "policy-1"),
    ).toThrow("policy_pack_identity_required");
  });

  it("rejects unknown packs", () => {
    expect(() => getPolicyPack("not-a-pack" as never)).toThrow(
      "policy_pack_not_found",
    );
  });
});
