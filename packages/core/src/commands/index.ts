export type CommandRisk = "low" | "medium" | "high" | "critical";
export type CommandSurface =
  "desktop" | "web" | "mobile" | "cli" | "mcp" | "agent";

export interface CommandDefinition {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly risk: CommandRisk;
  readonly scopes: readonly string[];
  readonly surfaces: readonly CommandSurface[];
  readonly mutatesState: boolean;
  readonly externallyVisible: boolean;
  readonly requiresApproval: boolean;
}

export interface CommandInvocation {
  readonly commandId: string;
  readonly workspaceId: string;
  readonly actorId: string;
  readonly grantedScopes: readonly string[];
  readonly approvalGranted: boolean;
}

export type CommandDecision =
  | { readonly allowed: true; readonly reason: "authorized" | "approved" }
  | {
      readonly allowed: false;
      readonly reason:
        | "unknown_command"
        | "workspace_required"
        | "actor_required"
        | "scope_denied"
        | "approval_required"
        | "surface_denied";
    };

const BUILTIN_COMMANDS: readonly CommandDefinition[] = [
  {
    id: "campaign.plan",
    title: "Plan campaign",
    description: "Compile a workspace-bound campaign plan from strategy.",
    risk: "medium",
    scopes: ["campaign:write", "strategy:read"],
    surfaces: ["desktop", "web", "mobile", "cli", "mcp", "agent"],
    mutatesState: true,
    externallyVisible: false,
    requiresApproval: false,
  },
  {
    id: "content.draft",
    title: "Draft content",
    description:
      "Create a content draft using approved strategy and knowledge.",
    risk: "low",
    scopes: ["content:write", "knowledge:read"],
    surfaces: ["desktop", "web", "mobile", "cli", "mcp", "agent"],
    mutatesState: true,
    externallyVisible: false,
    requiresApproval: false,
  },
  {
    id: "content.approve",
    title: "Approve content",
    description: "Approve a content item for governed distribution.",
    risk: "high",
    scopes: ["content:approve"],
    surfaces: ["desktop", "web", "mobile", "cli", "mcp"],
    mutatesState: true,
    externallyVisible: false,
    requiresApproval: true,
  },
  {
    id: "task.execute",
    title: "Execute task",
    description: "Run a governed work item through the execution fabric.",
    risk: "high",
    scopes: ["task:execute"],
    surfaces: ["desktop", "mobile", "cli", "mcp", "agent"],
    mutatesState: true,
    externallyVisible: true,
    requiresApproval: true,
  },
  {
    id: "conversation.reply",
    title: "Reply to conversation",
    description: "Send an approved response through a connected channel.",
    risk: "high",
    scopes: ["conversation:write"],
    surfaces: ["desktop", "web", "mobile", "cli", "mcp", "agent"],
    mutatesState: true,
    externallyVisible: true,
    requiresApproval: true,
  },
  {
    id: "experiment.define",
    title: "Define experiment",
    description: "Create or update a workspace-scoped marketing experiment.",
    risk: "medium",
    scopes: ["experiment:write"],
    surfaces: ["desktop", "web", "mobile", "cli", "mcp", "agent"],
    mutatesState: true,
    externallyVisible: false,
    requiresApproval: false,
  },
  {
    id: "experiment.assign",
    title: "Assign experiment variant",
    description:
      "Deterministically assign a subject to a declared experiment variant.",
    risk: "low",
    scopes: ["experiment:read"],
    surfaces: ["desktop", "web", "mobile", "cli", "mcp", "agent"],
    mutatesState: false,
    externallyVisible: false,
    requiresApproval: false,
  },
  {
    id: "experiment.observe",
    title: "Record experiment observation",
    description:
      "Persist a workspace-scoped experiment observation for later learning.",
    risk: "medium",
    scopes: ["experiment:write"],
    surfaces: ["desktop", "web", "mobile", "cli", "mcp", "agent"],
    mutatesState: true,
    externallyVisible: false,
    requiresApproval: false,
  },
  {
    id: "experiment.summarize",
    title: "Summarize experiment",
    description:
      "Read workspace-scoped experiment evidence without claiming statistical significance.",
    risk: "low",
    scopes: ["experiment:read"],
    surfaces: ["desktop", "web", "mobile", "cli", "mcp", "agent"],
    mutatesState: false,
    externallyVisible: false,
    requiresApproval: false,
  },
  {
    id: "agent.list",
    title: "List governed agents",
    description:
      "List workspace-scoped agent definitions without executing agent work.",
    risk: "low",
    scopes: ["agent:read"],
    surfaces: ["desktop", "web", "mobile", "cli", "mcp"],
    mutatesState: false,
    externallyVisible: false,
    requiresApproval: false,
  },
  {
    id: "analytics.explain",
    title: "Explain analytics",
    description: "Summarize workspace-scoped performance evidence.",
    risk: "low",
    scopes: ["analytics:read"],
    surfaces: ["desktop", "web", "mobile", "cli", "mcp", "agent"],
    mutatesState: false,
    externallyVisible: false,
    requiresApproval: false,
  },
  {
    id: "workflow.simulate",
    title: "Simulate workflow",
    description: "Produce a read-only governed execution plan.",
    risk: "low",
    scopes: ["workflow:simulate"],
    surfaces: ["desktop", "web", "mobile", "cli", "mcp", "agent"],
    mutatesState: false,
    externallyVisible: false,
    requiresApproval: false,
  },
  {
    id: "execution.replay",
    title: "Replay execution",
    description:
      "Reconstruct execution state without re-running external actions.",
    risk: "low",
    scopes: ["execution:replay"],
    surfaces: ["desktop", "web", "mobile", "cli", "mcp", "agent"],
    mutatesState: false,
    externallyVisible: false,
    requiresApproval: false,
  },
];

export class CommandRegistry {
  private readonly commands = new Map<string, CommandDefinition>();

  public constructor(
    commands: readonly CommandDefinition[] = BUILTIN_COMMANDS,
  ) {
    for (const command of commands) this.register(command);
  }

  public register(command: CommandDefinition): void {
    if (!command.id.trim()) throw new Error("command_id_required");
    if (!command.scopes.length) throw new Error("command_scope_required");
    if (
      command.externallyVisible &&
      command.mutatesState &&
      !command.requiresApproval
    ) {
      throw new Error("command_approval_contract_violation");
    }
    if (this.commands.has(command.id)) throw new Error("command_duplicate");
    this.commands.set(command.id, {
      ...command,
      scopes: [...command.scopes],
      surfaces: [...command.surfaces],
    });
  }

  public get(commandId: string): CommandDefinition | undefined {
    const command = this.commands.get(commandId);
    return command
      ? {
          ...command,
          scopes: [...command.scopes],
          surfaces: [...command.surfaces],
        }
      : undefined;
  }

  public list(): readonly CommandDefinition[] {
    return [...this.commands.values()]
      .map((command) => ({
        ...command,
        scopes: [...command.scopes],
        surfaces: [...command.surfaces],
      }))
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  public decide(
    invocation: CommandInvocation,
    surface: CommandSurface,
  ): CommandDecision {
    if (!invocation.workspaceId.trim())
      return { allowed: false, reason: "workspace_required" };
    if (!invocation.actorId.trim())
      return { allowed: false, reason: "actor_required" };

    const command = this.commands.get(invocation.commandId);
    if (!command) return { allowed: false, reason: "unknown_command" };
    if (!command.surfaces.includes(surface))
      return { allowed: false, reason: "surface_denied" };

    const hasScopes = command.scopes.every((scope) =>
      invocation.grantedScopes.includes(scope),
    );
    if (!hasScopes) return { allowed: false, reason: "scope_denied" };

    if (command.requiresApproval && !invocation.approvalGranted) {
      return { allowed: false, reason: "approval_required" };
    }

    return {
      allowed: true,
      reason: invocation.approvalGranted ? "approved" : "authorized",
    };
  }
}

export const DEFAULT_COMMANDS: readonly CommandDefinition[] = BUILTIN_COMMANDS;

export * from "./dispatcher.js";
