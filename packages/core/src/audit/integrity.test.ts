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

  it("detects tampering", async () => {
    const chain = new AuditIntegrityChain();
    await chain.append(event("1"));
    await chain.append(event("2"));
    const records = (chain as unknown as { records: Array<{ event: AuditEvent; previousHash: string; hash: string }> }).records;
    records[0].event.action = "tampered";
    expect(await chain.verify()).toBe(false);
  });
});
