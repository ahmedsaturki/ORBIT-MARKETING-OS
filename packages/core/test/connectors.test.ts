import { describe, expect, it } from "vitest";
import {
  executeCapability,
  handleChallenge,
  handshake,
} from "../src/connectors/index.js";
import type { ConnectorDescriptor } from "../src/types/index.js";

const descriptor: ConnectorDescriptor = {
  id: "facebook-browser",
  platform: "facebook",
  capabilities: ["publish", "comment", "read_inbox"],
  mode: "browser_assisted",
};

describe("connector capability handshake", () => {
  it("accepts when all declared capabilities are implemented", () => {
    const result = handshake(descriptor, ["publish", "comment", "read_inbox", "analytics"]);
    expect(result.ok).toBe(true);
  });

  it("rejects when declared capability is missing", () => {
    const result = handshake(descriptor, ["publish"]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.requiresIntervention).toBe(true);
      expect(result.error).toContain("comment");
    }
  });

  it("rejects unsupported action", () => {
    const result = executeCapability(descriptor, ["publish", "comment"], "direct_message", () => ({
      ok: true as const,
      data: null,
    }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("direct_message");
    }
  });

  it("runs supported capability and captures thrown errors as intervention", () => {
    const ok = executeCapability(descriptor, ["publish"], "publish", () => ({
      ok: true as const,
      data: { postId: "1" },
    }));
    expect(ok.ok).toBe(true);

    const thrown = executeCapability(descriptor, ["publish"], "publish", () => {
      throw new Error("dom changed");
    });
    expect(thrown.ok).toBe(false);
    if (!thrown.ok) {
      expect(thrown.requiresIntervention).toBe(true);
    }
  });
});

describe("challenge safe stop", () => {
  it("does nothing when no challenge", () => {
    const result = handleChallenge({ kind: "unknown_checkpoint", detected: false });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.requiresIntervention).toBe(false);
    }
  });

  it("stops safely and requests intervention on challenge", () => {
    const result = handleChallenge({ kind: "captcha", detected: true });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.requiresIntervention).toBe(true);
      expect(result.error).toContain("captcha");
    }
  });
});
