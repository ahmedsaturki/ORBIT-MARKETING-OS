import { describe, expect, it } from "vitest";
import { appendEntry, verifyChain } from "../src/audit/index.js";
import type { AuditEntry } from "../src/types/index.js";

const base = {
  workspaceId: "ws-1",
  actorId: "user-1",
  entityRef: "content-1",
  timestamp: "2026-09-24T10:00:00.000Z",
};

describe("audit chain", () => {
  it("builds a verifiable hash chain", () => {
    let chain: AuditEntry[] = [];
    chain = appendEntry(chain, { ...base, id: "a1", action: "content.created" });
    chain = appendEntry(chain, { ...base, id: "a2", action: "content.approved" });
    chain = appendEntry(chain, { ...base, id: "a3", action: "task.dispatched" });
    expect(chain).toHaveLength(3);
    expect(verifyChain(chain)).toEqual({ valid: true });
  });

  it("detects tampered entry", () => {
    let chain: AuditEntry[] = [];
    chain = appendEntry(chain, { ...base, id: "a1", action: "content.created" });
    chain = appendEntry(chain, { ...base, id: "a2", action: "content.approved" });
    const tampered = [
      chain[0],
      { ...chain[1], action: "task.dispatched" },
    ] as AuditEntry[];
    const result = verifyChain(tampered);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(1);
  });

  it("detects broken prevHash link", () => {
    let chain: AuditEntry[] = [];
    chain = appendEntry(chain, { ...base, id: "a1", action: "content.created" });
    chain = appendEntry(chain, { ...base, id: "a2", action: "content.approved" });
    const broken = [chain[0], { ...chain[1], prevHash: "deadbeef" }] as AuditEntry[];
    const result = verifyChain(broken);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(1);
  });
});
