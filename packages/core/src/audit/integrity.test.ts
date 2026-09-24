import { describe, expect, it } from "vitest";
import { AuditIntegrityChain } from "./integrity.js";
import type { AuditEvent } from "../types/index.js";

const event = (id: string): AuditEvent => ({
  id,
  timestamp: "2026-09-24T00:00:00.000Z",
  workspaceId: "ws-1",
  category: "security",
  action: "test",
  outcome: "success",
  actor: "system",
});

describe("AuditIntegrityChain", () => {
  it("verifies a valid append-only chain", async () => {
    const chain = new AuditIntegrityChain();
    await chain.append(event("1"));
    await chain.append(event("2"));
    expect(await chain.verify()).toBe(true);
  });

  it("isolates stored events from caller mutation", async () => {
    const chain = new AuditIntegrityChain();
    const original = event("1");
    await chain.append(original);
    original.action = "tampered";
    expect(await chain.verify()).toBe(true);
    expect(chain.snapshot()[0]?.event.action).toBe("test");
  });

  it("returns an isolated snapshot", async () => {
    const chain = new AuditIntegrityChain();
    await chain.append(event("1"));
    const snapshot = chain.snapshot();
    (snapshot[0]!.event as AuditEvent).action = "tampered";
    expect(await chain.verify()).toBe(true);
    expect(chain.snapshot()[0]?.event.action).toBe("test");
  });
});
