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
    const original = { ...event("1") };
    await chain.append(original);
    original.action = "tampered";
    expect(await chain.verify()).toBe(true);
    expect(chain.snapshot()[0]?.event.action).toBe("test");
  });

  it("returns an isolated snapshot", async () => {
    const chain = new AuditIntegrityChain();
    await chain.append(event("1"));
    const snapshot = chain.snapshot();
    const tamperedEvent = { ...snapshot[0]!.event };
    tamperedEvent.action = "tampered";
    expect(await chain.verify()).toBe(true);
    expect(chain.snapshot()[0]?.event.action).toBe("test");
  });

  // The rest of this suite asserts verify() === true. Tamper detection is the
  // entire point of the chain, so the failure branch must also be exercised:
  // if a persisted record is edited out of band, verify() has to reject it.
  //
  // `records` is private and `AuditRecord` is readonly by design, so each case
  // reaches it through a named mutable view. That stands in for an attacker
  // (or a bug) editing stored audit state directly; the domain types stay
  // untouched.
  interface MutableAuditRecord {
    event: { action: string; metadata?: Record<string, unknown> };
    previousHash: string;
    hash: string;
  }
  const tamperable = (chain: AuditIntegrityChain): MutableAuditRecord[] =>
    (chain as unknown as { records: MutableAuditRecord[] }).records;

  it("rejects a chain whose stored event was edited after append", async () => {
    const chain = new AuditIntegrityChain();
    await chain.append(event("1"));
    await chain.append(event("2"));
    expect(await chain.verify()).toBe(true);

    tamperable(chain)[0]!.event.action = "tampered";

    expect(await chain.verify()).toBe(false);
  });

  it("rejects a chain whose stored metadata was edited after append", async () => {
    const chain = new AuditIntegrityChain();
    await chain.append({
      ...event("1"),
      metadata: { approval: "granted" },
    });
    expect(await chain.verify()).toBe(true);

    tamperable(chain)[0]!.event.metadata = { approval: "revoked" };

    expect(await chain.verify()).toBe(false);
  });

  it("rejects a chain with a broken previous-hash link", async () => {
    const chain = new AuditIntegrityChain();
    await chain.append(event("1"));
    await chain.append(event("2"));
    await chain.append(event("3"));
    expect(await chain.verify()).toBe(true);

    // Re-hash the tampered record so its own hash is self-consistent; only the
    // link back to its predecessor is wrong. A checker that only validates
    // per-record hashes would miss this.
    tamperable(chain)[1]!.previousHash = "0".repeat(64);

    expect(await chain.verify()).toBe(false);
  });

  it("rejects a chain from which a middle record was removed", async () => {
    const chain = new AuditIntegrityChain();
    await chain.append(event("1"));
    await chain.append(event("2"));
    await chain.append(event("3"));
    expect(await chain.verify()).toBe(true);

    tamperable(chain).splice(1, 1);

    expect(await chain.verify()).toBe(false);
  });

  it("rejects a chain whose record hash was rewritten", async () => {
    const chain = new AuditIntegrityChain();
    await chain.append(event("1"));
    expect(await chain.verify()).toBe(true);

    tamperable(chain)[0]!.hash = "f".repeat(64);

    expect(await chain.verify()).toBe(false);
  });
});
