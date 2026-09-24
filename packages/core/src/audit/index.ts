import { createHash } from "node:crypto";
import type { AuditEntry } from "../types/index.js";

export type AuditInput = Omit<AuditEntry, "hash" | "prevHash">;

function stableStringify(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

function normalizedPayload(input: AuditInput, prevHash?: string) {
  return {
    id: input.id,
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    action: input.action,
    entityRef: input.entityRef,
    timestamp: input.timestamp,
    metadata: input.metadata ?? null,
    prevHash: prevHash ?? null,
  };
}

export function computeEntryHash(input: AuditInput, prevHash?: string): string {
  const payload = stableStringify(normalizedPayload(input, prevHash));
  return createHash("sha256").update(payload).digest("hex");
}

export function appendEntry(
  chain: readonly AuditEntry[],
  input: AuditInput,
): AuditEntry[] {
  const prev = chain[chain.length - 1];
  const entry: AuditEntry = {
    ...input,
    prevHash: prev?.hash,
    hash: computeEntryHash(input, prev?.hash),
  };
  return [...chain, entry];
}

export function verifyChain(chain: readonly AuditEntry[]): {
  readonly valid: boolean;
  readonly brokenAt?: number;
} {
  let prevHash: string | undefined;
  for (let i = 0; i < chain.length; i += 1) {
    const entry = chain[i];
    if (entry.prevHash !== prevHash) {
      return { valid: false, brokenAt: i };
    }
    const expected = computeEntryHash(
      {
        id: entry.id,
        workspaceId: entry.workspaceId,
        actorId: entry.actorId,
        action: entry.action,
        entityRef: entry.entityRef,
        timestamp: entry.timestamp,
        ...(entry.metadata !== undefined ? { metadata: entry.metadata } : {}),
      },
      prevHash,
    );
    if (expected !== entry.hash) {
      return { valid: false, brokenAt: i };
    }
    prevHash = entry.hash;
  }
  return { valid: true };
}
