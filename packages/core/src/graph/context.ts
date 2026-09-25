import type {
  OperatingGraph,
  OperatingGraphLink,
  OperatingGraphNode,
} from "./index.js";

export interface GraphContextOptions {
  readonly maxDepth?: number;
  readonly maxNodes?: number;
  readonly relations?: readonly string[];
}

export interface GraphContext {
  readonly root: OperatingGraphNode;
  readonly nodes: readonly OperatingGraphNode[];
  readonly links: readonly OperatingGraphLink[];
  readonly depth: number;
  readonly truncated: boolean;
}

function key(node: Pick<OperatingGraphNode, "type" | "id">): string {
  return node.type + ":" + node.id;
}

/**
 * Produces a bounded, deterministic graph projection suitable for AI/agent
 * context. It never expands beyond the requested depth/node budget.
 */
export function projectGraphContext(
  graph: OperatingGraph,
  root: Pick<OperatingGraphNode, "type" | "id">,
  options: GraphContextOptions = {},
): GraphContext {
  const maxDepth = Math.max(0, Math.floor(options.maxDepth ?? 2));
  const maxNodes = Math.max(1, Math.floor(options.maxNodes ?? 50));
  const allowedRelations = options.relations
    ? new Set(options.relations)
    : undefined;

  const rootNode = graph.nodes.find(
    (candidate) => candidate.type === root.type && candidate.id === root.id,
  );
  if (!rootNode) throw new Error("graph_root_not_found");
  if (rootNode.workspaceId !== graph.workspaceId) {
    throw new Error("graph_root_workspace_mismatch");
  }

  const nodeMap = new Map(graph.nodes.map((node) => [key(node), node]));
  const seen = new Set<string>([key(rootNode)]);
  const queue: Array<{ node: OperatingGraphNode; depth: number }> = [
    { node: rootNode, depth: 0 },
  ];
  const selectedDepth = new Map<string, number>([[key(rootNode), 0]]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.depth >= maxDepth) continue;

    for (const link of graph.links) {
      if (allowedRelations && !allowedRelations.has(link.relation)) continue;

      const currentKey = key(current.node);
      const nextKey =
        link.fromType === current.node.type && link.fromId === current.node.id
          ? key({ type: link.toType, id: link.toId })
          : link.toType === current.node.type && link.toId === current.node.id
            ? key({ type: link.fromType, id: link.fromId })
            : null;

      if (!nextKey || seen.has(nextKey)) continue;

      const next = nodeMap.get(nextKey);
      if (!next) continue;
      if (seen.size >= maxNodes) {
        return buildContext(graph, rootNode, seen, selectedDepth, maxDepth, true, allowedRelations);
      }

      const depth = current.depth + 1;
      seen.add(nextKey);
      selectedDepth.set(nextKey, depth);
      queue.push({ node: next, depth });
    }
  }

  return buildContext(graph, rootNode, seen, selectedDepth, maxDepth, false, allowedRelations);
}

function buildContext(
  graph: OperatingGraph,
  root: OperatingGraphNode,
  seen: ReadonlySet<string>,
  depths: ReadonlyMap<string, number>,
  maxDepth: number,
  truncated: boolean,
  allowedRelations?: ReadonlySet<string>,
): GraphContext {
  const nodes = graph.nodes.filter((node) => seen.has(key(node)));
  const links = graph.links.filter((link) => {
    if (allowedRelations && !allowedRelations.has(link.relation)) return false;
    return (
      seen.has(key({ type: link.fromType, id: link.fromId })) &&
      seen.has(key({ type: link.toType, id: link.toId }))
    );
  });

  const depth = Math.max(...Array.from(depths.values()));
  return {
    root,
    nodes,
    links,
    depth: Math.min(depth, maxDepth),
    truncated,
  };
}
