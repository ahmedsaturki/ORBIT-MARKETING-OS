import type { AuditEvent } from "../types/index.js";
import { redactRecord } from "../security/redaction.js";

export function createAuditEvent(input: Omit<AuditEvent, "id"> & { id?: string }): AuditEvent {
  const id = input.id?.trim() || crypto.randomUUID();
  const metadata = input.metadata
    ? (redactRecord(input.metadata) as AuditEvent["metadata"])
    : undefined;

  return {
    ...input,
    id,
    metadata,
  };
}

export class AuditLog {
  private readonly entries: AuditEvent[] = [];

  /**
   * Append a redacted, immutable-in-place audit event.
   */
  public append(event: AuditEvent): void {
    this.entries.push(createAuditEvent(event));
  }

  /**
   * Return a defensive copy so callers cannot mutate the stored log.
   */
  public list(): readonly AuditEvent[] {
    return this.entries.map((entry) => ({
      ...entry,
      metadata: entry.metadata ? { ...entry.metadata } : undefined,
    }));
  }
}
