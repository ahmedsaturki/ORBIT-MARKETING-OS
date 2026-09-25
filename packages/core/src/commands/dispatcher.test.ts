import { describe, expect, it, vi } from "vitest";
import { CommandDispatcher } from "./dispatcher.js";
import { CommandRegistry } from "./index.js";
import { OperationalEventLog } from "../events/index.js";

function invocation(
  commandId: string,
  overrides: Partial<{
    workspaceId: string;
    actorId: string;
    grantedScopes: readonly string[];
    approvalGranted: boolean;
  }> = {},
) {
  return {
    commandId,
    workspaceId: overrides.workspaceId ?? "ws-1",
    actorId: overrides.actorId ?? "user-1",
    grantedScopes: overrides.grantedScopes ?? ["analytics:read"],
    approvalGranted: overrides.approvalGranted ?? false,
  };
}

describe("CommandDispatcher", () => {
  it("executes a registered handler with a contiguous trace", async () => {
    const dispatcher = new CommandDispatcher();
    const log = new OperationalEventLog("ws-1");
    const handler = vi.fn(async (input: unknown, context) => ({
      input,
      commandId: context.definition.id,
    }));

    dispatcher.register("analytics.explain", handler);

    const result = await dispatcher.execute(
      {
        invocation: invocation("analytics.explain"),
        surface: "desktop",
        actor: "user",
        input: { accessToken: "must-not-be-persisted" },
      },
      log,
    );

    expect(result.ok).toBe(true);
    expect(handler).toHaveBeenCalledOnce();
    expect(result.output).toEqual({
      input: { accessToken: "must-not-be-persisted" },
      commandId: "analytics.explain",
    });

    expect(result.events.map((event) => event.kind)).toEqual([
      "command.received",
      "command.authorized",
      "command.completed",
    ]);
    expect(result.events.map((event) => event.sequence)).toEqual([1, 2, 3]);
    expect(new Set(result.events.map((event) => event.traceId)).size).toBe(1);
    expect(result.events[1]?.parentEventId).toBe(result.events[0]?.id);
    expect(result.events[2]?.parentEventId).toBe(result.events[1]?.id);
    expect(result.events[0]?.payload).toEqual({
      surface: "desktop",
      inputPresent: true,
    });
    expect(JSON.stringify(log.list())).not.toContain("must-not-be-persisted");
  });

  it("blocks a denied command without invoking its handler", async () => {
    const registry = new CommandRegistry();
    const dispatcher = new CommandDispatcher(registry);
    const log = new OperationalEventLog("ws-1");
    const handler = vi.fn();

    dispatcher.register("analytics.explain", handler);

    const result = await dispatcher.execute(
      {
        invocation: invocation("analytics.explain", {
          grantedScopes: [],
        }),
        surface: "desktop",
        actor: "user",
      },
      log,
    );

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: "scope_denied",
      }),
    );
    expect(handler).not.toHaveBeenCalled();
    expect(log.list().map((event) => event.kind)).toEqual([
      "command.received",
      "command.blocked",
    ]);
  });

  it("requires approval before dispatching externally visible mutable work", async () => {
    const dispatcher = new CommandDispatcher();
    const log = new OperationalEventLog("ws-1");
    const handler = vi.fn();

    dispatcher.register("task.execute", handler);

    const result = await dispatcher.execute(
      {
        invocation: invocation("task.execute", {
          grantedScopes: ["task:execute"],
        }),
        surface: "desktop",
        actor: "user",
      },
      log,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe("approval_required");
    expect(handler).not.toHaveBeenCalled();
  });

  it("records an explicit failure when a command has no handler", async () => {
    const dispatcher = new CommandDispatcher();
    const log = new OperationalEventLog("ws-1");

    const result = await dispatcher.execute(
      {
        invocation: invocation("analytics.explain"),
        surface: "desktop",
        actor: "system",
      },
      log,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe("command_handler_missing");
    expect(log.list().at(-1)?.outcome).toBe("failed");
  });

  it("captures handler failures without throwing past the command boundary", async () => {
    const dispatcher = new CommandDispatcher();
    const log = new OperationalEventLog("ws-1");

    dispatcher.register("analytics.explain", () => {
      throw new Error("controlled-handler-failure");
    });

    const result = await dispatcher.execute(
      {
        invocation: invocation("analytics.explain"),
        surface: "desktop",
        actor: "agent",
      },
      log,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe("controlled-handler-failure");
    expect(log.list().at(-1)?.outcome).toBe("failed");
  });

  it("uses distinct traces for separate command invocations", async () => {
    const dispatcher = new CommandDispatcher();
    const firstLog = new OperationalEventLog("ws-1");
    const secondLog = new OperationalEventLog("ws-1");

    dispatcher.register("analytics.explain", () => ({ ok: true }));

    const first = await dispatcher.execute(
      {
        invocation: invocation("analytics.explain"),
        surface: "desktop",
        actor: "user",
      },
      firstLog,
    );
    const second = await dispatcher.execute(
      {
        invocation: invocation("analytics.explain"),
        surface: "desktop",
        actor: "user",
      },
      secondLog,
    );

    expect(first.events[0]?.traceId).toBeTruthy();
    expect(first.events[0]?.traceId).not.toBe(second.events[0]?.traceId);
  });
});
