import { redactRecord } from "../security/redaction.js";

export type OperationalEventOutcome = "started" | "succeeded" | "failed" | "blocked" | "waiting";
export type OperationalEventKind =
  | "command.received"
  | "command.authorized"
  | "command.blocked"
  | "command.completed"
  | "work.created"
  | "work.state_changed"
  | "connector.dispatched"
  | "connector.result"
  | "human.intervention_required"
  | "approval.requested"
  | "approval.decided"
  | "insight.recorded";

export interface OperationalEvent {
  readonly id: string;
  readonly sequence: number;
  readonly workspaceId: string;
  readonly timestamp: string;
  readonly kind: OperationalEventKind;
  readonly outcome: OperationalEventOutcome;
  readonly actor: "user" | "system" | "agent" | "connector";
  readonly actorId: string;
  readonly entityType?: string;
  readonly entityId?: string;
  readonly traceId?: string;
  readonly parentEventId?: string;
  readonly payload?: Readonly<Record<string, unknown>>;
}

export interface OperationalEventInput
  extends Omit<OperationalEvent, "id" | "sequence"> {
  readonly id?: string;
  readonly sequence?: number;
}

function assertTimestamp(value: string): void {
  if (!value.trim() || Number.isNaN(Date.parse(value))) {
    throw new Error("operational_event_invalid_timestamp");
  }
}

function cloneValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        cloneValue(entry),
      ]),
    );
  }
  return value;
}

function cloneEvent(event: OperationalEvent): OperationalEvent {
  return {
    ...event,
    ...(event.payload
      ? { payload: cloneValue(event.payload) as Readonly<Record<string, unknown>> }
      : {}),
  };
}

export function createOperationalEvent(input: OperationalEventInput): OperationalEvent {
  if (!input.workspaceId.trim()) throw new Error("operational_event_workspace_required");
  if (!input.actorId.trim()) throw new Error("operational_event_actor_required");
  assertTimestamp(input.timestamp);

  const sequence = input.sequence ?? 0;
  if (!Number.isSafeInteger(sequence) || sequence < 0) {
    throw new Error("operational_event_invalid_sequence");
  }

  const payload = input.payload
    ? redactRecord(input.payload)
    : undefined;

  return {
    ...input,
    id: input.id?.trim() || crypto.randomUUID(),
    sequence,
    ...(payload ? { payload } : {}),
  };
}

/**
 * Append-only operational trace for the local runtime.
 *
 * AuditLog remains the compliance-oriented history. This spine is the
 * execution/coordination trace consumed by replay, diagnostics, and future
 * CLI/MCP/agent surfaces. It never executes external work itself.
 */
export class OperationalEventLog {
  private readonly events: OperationalEvent[] = [];
  private readonly ids = new Set<string>();
  private nextSequence = 1;

  public constructor(private readonly workspaceId: string) {
    if (!workspaceId.trim()) throw new Error("operational_event_workspace_required");
  }

  public append(input: OperationalEventInput): OperationalEvent {
    if (input.workspaceId !== this.workspaceId) {
      throw new Error("operational_event_workspace_mismatch");
    }

    const requestedSequence = input.sequence;
    if (requestedSequence !== undefined && requestedSequence !== this.nextSequence) {
      throw new Error("operational_event_sequence_mismatch");
    }

    const event = createOperationalEvent({
      ...input,
      sequence: this.nextSequence,
    });

    if (this.ids.has(event.id)) throw new Error("operational_event_duplicate_id");
    if (event.parentEventId && !this.ids.has(event.parentEventId)) {
      throw new Error("operational_event_parent_missing");
    }

    this.events.push(event);
    this.ids.add(event.id);
    this.nextSequence += 1;
    return cloneEvent(event);
  }

  public list(): readonly OperationalEvent[] {
    return this.events.map(cloneEvent);
  }

  public forEntity(
    entityType: string,
    entityId: string,
  ): readonly OperationalEvent[] {
    return this.events
      .filter((event) => event.entityType === entityType && event.entityId === entityId)
      .map(cloneEvent);
  }

  public forTrace(traceId: string): readonly OperationalEvent[] {
    return this.events.filter((event) => event.traceId === traceId).map(cloneEvent);
  }

  public snapshot(): { readonly workspaceId: string; readonly nextSequence: number; readonly events: readonly OperationalEvent[] } {
    return {
      workspaceId: this.workspaceId,
      nextSequence: this.nextSequence,
      events: this.list(),
    };
  }
}
