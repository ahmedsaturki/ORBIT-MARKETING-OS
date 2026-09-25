import {
  CommandRegistry,
  type CommandDecision,
  type CommandInvocation,
  type CommandSurface,
} from "./index.js";
import {
  OperationalEventLog,
  type OperationalEvent,
} from "../events/index.js";

export interface CommandExecutionRequest {
  readonly invocation: CommandInvocation;
  readonly surface: CommandSurface;
  readonly actor: OperationalEvent["actor"];
  readonly input?: unknown;
}

export interface CommandExecutionContext {
  readonly request: CommandExecutionRequest;
  readonly definition: NonNullable<ReturnType<CommandRegistry["get"]>>;
  readonly receivedEvent: OperationalEvent;
  readonly authorizedEvent: OperationalEvent;
}

export type CommandHandler = (
  input: unknown,
  context: CommandExecutionContext,
) => unknown | Promise<unknown>;

export interface CommandExecutionResult {
  readonly ok: boolean;
  readonly commandId: string;
  readonly decision: CommandDecision;
  readonly output?: unknown;
  readonly error?: string;
  readonly events: readonly OperationalEvent[];
}

function now(): string {
  return new Date().toISOString();
}

function eventPayload(request: CommandExecutionRequest): Record<string, unknown> {
  return {
    surface: request.surface,
    actor: request.actor,
    ...(request.input !== undefined ? { input: request.input } : {}),
  };
}

/**
 * Shared side-effect coordinator for all ORBIT surfaces.
 *
 * The dispatcher only decides and coordinates a registered handler. External
 * work remains inside governed handlers/execution fabric; the dispatcher never
 * bypasses authorization, approval, policy, safety budgets, or connectors.
 */
export class CommandDispatcher {
  private readonly handlers = new Map<string, CommandHandler>();

  public constructor(
    private readonly registry: CommandRegistry = new CommandRegistry(),
  ) {}

  public register(commandId: string, handler: CommandHandler): void {
    const normalized = commandId.trim();
    if (!normalized) throw new Error("command_handler_id_required");
    if (!this.registry.get(normalized)) {
      throw new Error("command_handler_unknown_command");
    }
    if (this.handlers.has(normalized)) {
      throw new Error("command_handler_duplicate");
    }
    this.handlers.set(normalized, handler);
  }

  public async execute(
    request: CommandExecutionRequest,
    eventLog: OperationalEventLog,
  ): Promise<CommandExecutionResult> {
    const receivedEvent = eventLog.append({
      workspaceId: request.invocation.workspaceId,
      timestamp: now(),
      kind: "command.received",
      outcome: "started",
      actor: request.actor,
      actorId: request.invocation.actorId,
      entityType: "command",
      entityId: request.invocation.commandId,
      traceId: request.invocation.commandId,
      payload: eventPayload(request),
    });

    const decision = this.registry.decide(
      request.invocation,
      request.surface,
    );

    if (!decision.allowed) {
      const blockedEvent = eventLog.append({
        workspaceId: request.invocation.workspaceId,
        timestamp: now(),
        kind: "command.blocked",
        outcome: "blocked",
        actor: request.actor,
        actorId: request.invocation.actorId || "unknown",
        entityType: "command",
        entityId: request.invocation.commandId,
        traceId: receivedEvent.traceId,
        parentEventId: receivedEvent.id,
        payload: { reason: decision.reason, surface: request.surface },
      });

      return {
        ok: false,
        commandId: request.invocation.commandId,
        decision,
        error: decision.reason,
        events: [receivedEvent, blockedEvent],
      };
    }

    const definition = this.registry.get(request.invocation.commandId);
    if (!definition) {
      throw new Error("command_registry_invariant_broken");
    }

    const authorizedEvent = eventLog.append({
      workspaceId: request.invocation.workspaceId,
      timestamp: now(),
      kind: "command.authorized",
      outcome: "succeeded",
      actor: request.actor,
      actorId: request.invocation.actorId,
      entityType: "command",
      entityId: request.invocation.commandId,
      traceId: receivedEvent.traceId,
      parentEventId: receivedEvent.id,
      payload: { surface: request.surface, reason: decision.reason },
    });

    const handler = this.handlers.get(request.invocation.commandId);
    if (!handler) {
      const missingHandler = eventLog.append({
        workspaceId: request.invocation.workspaceId,
        timestamp: now(),
        kind: "command.completed",
        outcome: "failed",
        actor: "system",
        actorId: "command-dispatcher",
        entityType: "command",
        entityId: request.invocation.commandId,
        traceId: receivedEvent.traceId,
        parentEventId: authorizedEvent.id,
        payload: { reason: "command_handler_missing" },
      });

      return {
        ok: false,
        commandId: request.invocation.commandId,
        decision,
        error: "command_handler_missing",
        events: [receivedEvent, authorizedEvent, missingHandler],
      };
    }

    const context: CommandExecutionContext = {
      request,
      definition,
      receivedEvent,
      authorizedEvent,
    };

    try {
      const output = await handler(request.input, context);
      const completedEvent = eventLog.append({
        workspaceId: request.invocation.workspaceId,
        timestamp: now(),
        kind: "command.completed",
        outcome: "succeeded",
        actor: request.actor,
        actorId: request.invocation.actorId,
        entityType: "command",
        entityId: request.invocation.commandId,
        traceId: receivedEvent.traceId,
        parentEventId: authorizedEvent.id,
        payload: { surface: request.surface },
      });

      return {
        ok: true,
        commandId: request.invocation.commandId,
        decision,
        output,
        events: [receivedEvent, authorizedEvent, completedEvent],
      };
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : String(caught);
      const failedEvent = eventLog.append({
        workspaceId: request.invocation.workspaceId,
        timestamp: now(),
        kind: "command.completed",
        outcome: "failed",
        actor: "system",
        actorId: "command-dispatcher",
        entityType: "command",
        entityId: request.invocation.commandId,
        traceId: receivedEvent.traceId,
        parentEventId: authorizedEvent.id,
        payload: { surface: request.surface, error: message },
      });

      return {
        ok: false,
        commandId: request.invocation.commandId,
        decision,
        error: message,
        events: [receivedEvent, authorizedEvent, failedEvent],
      };
    }
  }
}
