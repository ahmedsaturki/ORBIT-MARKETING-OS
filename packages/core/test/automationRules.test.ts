import { describe, expect, it } from "vitest";
import { resolveAutomationRule, validateAutomationRulePack, type AutomationRulePack } from "../src/automation/rules.js";

const pack: AutomationRulePack = {
  schemaVersion: 1,
  id: "facebook-default",
  platform: "facebook",
  version: "1.0.0",
  rules: [
    {
      id: "publish",
      platform: "facebook",
      taskKinds: ["publish"],
      enabled: true,
      requiresConfirmation: true,
      maxAttempts: 3,
      timeoutMs: 30_000,
    },
    {
      id: "sync",
      platform: "facebook",
      taskKinds: ["sync"],
      enabled: true,
      requiresConfirmation: false,
      maxAttempts: 1,
      timeoutMs: 60_000,
    },
  ],
};

describe("automation rule packs", () => {
  it("validates a versioned pack and resolves enabled rules", () => {
    expect(validateAutomationRulePack(pack).valid).toBe(true);
    expect(resolveAutomationRule(pack, "publish")?.id).toBe("publish");
    expect(resolveAutomationRule(pack, "message")).toBeUndefined();
  });

  it("rejects enabled external rules that skip confirmation", () => {
    const result = validateAutomationRulePack({
      ...pack,
      rules: [{ ...pack.rules[0]!, requiresConfirmation: false }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("enabled external rules must require confirmation");
  });

  it("rejects duplicate ids, bad platform and unsafe timeout/attempt bounds", () => {
    const result = validateAutomationRulePack({
      ...pack,
      rules: [
        ...pack.rules,
        { ...pack.rules[0]!, id: "publish", platform: "instagram", timeoutMs: 999_999, maxAttempts: 20 },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      "rule ids must be unique",
      "rule platform must match rule pack platform",
      "rule maxAttempts must be between 1 and 10",
      "rule timeoutMs must be between 1000 and 300000",
    ]));
  });
});
