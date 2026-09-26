import type {
  CommandDefinition,
  CommandInvocation,
  CommandSurface,
} from "./index.js";
import { CommandRegistry } from "./index.js";

export interface CommandSurfacePreview {
  readonly command: CommandDefinition;
  readonly decision: ReturnType<CommandRegistry["decide"]>;
  readonly surface: CommandSurface;
  readonly invocation: CommandInvocation;
}

/**
 * Read-only projection of the canonical command registry for an operator surface.
 * It never creates a second catalog and never grants permissions.
 */
export function listCommandsForSurface(
  surface: CommandSurface,
  registry: CommandRegistry = new CommandRegistry(),
): readonly CommandDefinition[] {
  return registry
    .list()
    .filter((command) => command.surfaces.includes(surface));
}

/**
 * Read-only authorization preview for CLI/MCP/agent clients.
 *
 * Previewing never executes a handler, dispatches a connector, or mutates state.
 * Actual execution must still go through the canonical CommandDispatcher owned
 * by the runtime.
 */
export function previewCommandInvocation(input: {
  readonly commandId: string;
  readonly workspaceId: string;
  readonly actorId: string;
  readonly grantedScopes: readonly string[];
  readonly approvalGranted?: boolean;
  readonly surface: CommandSurface;
  readonly registry?: CommandRegistry;
}): CommandSurfacePreview {
  const registry = input.registry ?? new CommandRegistry();
  const invocation: CommandInvocation = {
    commandId: input.commandId,
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    grantedScopes: [...input.grantedScopes],
    approvalGranted: input.approvalGranted ?? false,
  };

  const command = registry.get(input.commandId);
  const decision = registry.decide(invocation, input.surface);

  if (!command) {
    const unknown: CommandDefinition = {
      id: input.commandId,
      title: "Unknown command",
      description: "The command is not registered in the canonical registry.",
      risk: "critical",
      scopes: [],
      surfaces: [],
      mutatesState: false,
      externallyVisible: false,
      requiresApproval: false,
    };
    return { command: unknown, decision, surface: input.surface, invocation };
  }

  return { command, decision, surface: input.surface, invocation };
}
\n
