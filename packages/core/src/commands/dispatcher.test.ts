import { describe, expect, it } from "vitest";
import { CommandDispatcher } from "./dispatcher.js";
import { CommandRegistry } from "./index.js";
import { OperationalEventLog } from "../events/index.js";

const approvedExecution = {
  commandId: "task.execute",
  workspaceId: "ws-1",
  actorId: "user-1",
  grantedScopes: ["task:execute"],
  approvalGranted: true,
};

describe("CommandDispatcher", () => {
  it("runs a registered handler through one governed event trace", async () => {
    const dispatcher = new CommandDispatcher();
    dispatcher.register("task.execute", async (input) => ({
      accepted: true,
      input,
    }));

    const eventLog = new OperationalEventLog("ws-1");
    const result = await dispatcher.execute(
      {
        invocation: approvedExecution,
        surface: "desktop",
        actor: "user",
        input: { taskId: "task-1" },
      },
      eventLog,
    );

    expect(result.ok).toBe(true);
    expect(result.output).toEqual({
      accepted: true,
      input: { taskId: "task-1" },
    });
    expect(result.events.map((event) => event.kind)).toEqual([
      "command.received",
      "command.authorized",
      "command.completed",
    ]);
    expect(eventLog.list()).toHaveLength(3);
    expect(eventLog.list()[2].parentEventId).toBe(eventLog.list()[1].id);
  });

  it("blocks before a handler can run", async () => {
    const dispatcher = new CommandDispatcher();
    let calls = 0;
    dispatcher.register("task.execute", () => {
      calls += 1;
      return "should-not-run";
    });

    const eventLog = new OperationalEventLog("ws-1");
    const result = await dispatcher.execute(
      {
        invocation: {
          ...approvedExecution,
          approvalGranted: false,
        },
        surface: "desktop",
        actor: "user",
      },
      eventLog,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe("approval_required");
    expect(calls).toBe(0);
    expect(eventLog.list().map((event) => event.outcome)).toEqual([
      "started",
      "blocked",
    ]);
  });

  it("fails closed when no handler exists after authorization", async () => {
    const dispatcher = new CommandDispatcher();
    const eventLog = new OperationalEventLog("ws-1");

    const result = await dispatcher.execute(
      {
        invocation: approvedExecution,
        surface: "desktop",
        actor: "user",
      },
      eventLog,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe("command_handler_missing");
    expect(eventLog.list().map((event) => event.kind)).toEqual([
      "command.received",
      "command.authorized",
      "command.completed",
    ]);
  });

  it("captures handler failures without throwing past the command boundary", async () => {
    const dispatcher = new CommandDispatcher();
    dispatcher.register("task.execute", () => {
      throw new Error("connector refused");
    });

    const eventLog = new OperationalEventLog("ws-1");
    const result = await dispatcher.execute(
      {
        invocation: approvedExecution,
        surface: "desktop",
        actor: "user",
      },
      eventLog,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe("connector refused");
    expect(eventLog.list()[2].outcome).toBe("failed");
  });

  it("rejects handlers for unknown or duplicate commands", () => {
    const dispatcher = new CommandDispatcher(new CommandRegistry());
    expect(() => dispatcher.register("unknown.command", () => undefined)).toThrow(
      "command_handler_unknown_command",
    );
    dispatcher.register("analytics.explain", () => "ok");
    expect(() =>
      dispatcher.register("analytics.explain", () => "duplicate"),
    ).toThrow("command_handler_duplicate");
  });
});
