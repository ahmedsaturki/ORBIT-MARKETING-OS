import type { AuditEvent } from "../types/index.js";
import { redactRecord } from "../security/redaction.js";

export interface AuditRecord {
  readonly event: AuditEvent;
  readonly previousHash: string;
  readonly hash: string;
}

function canonicalize(event: AuditEvent): string {
  return JSON.stringify({
    id: event.id,
    timestamp: event.timestamp,
    workspaceId: event.workspaceId,
    category: event.category,
    action: event.action,
    outcome: event.outcome,
    actor: event.actor,
    entityId: event.entityId ?? null,
    metadata: event.metadata ? redactRecord(event.metadata) : null,
  });
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Append-only hash chaining for tamper-evident local audit storage. */
export class AuditIntegrityChain {
  private readonly records: AuditRecord[] = [];

  public async append(event: AuditEvent): Promise<AuditRecord> {
    const storedEvent = structuredClone(event);
    const previousHash = this.records.at(-1)?.hash ?? "GENESIS";
    const hash = await sha256(previousHash + "\n" + canonicalize(storedEvent));
    const record = { event: storedEvent, previousHash, hash } satisfies AuditRecord;
    this.records.push(record);
    return structuredClone(record);
  }

  public async verify(): Promise<boolean> {
    let previousHash = "GENESIS";
    for (const record of this.records) {
      const expected = await sha256(previousHash + "\n" + canonicalize(record.event));
      if (record.previousHash !== previousHash || record.hash !== expected) return false;
      previousHash = record.hash;
    }
    return true;
  }

  /** Returns an isolated copy so callers cannot mutate internal audit state. */
  public snapshot(): readonly AuditRecord[] {
    return structuredClone(this.records);
  }
}
