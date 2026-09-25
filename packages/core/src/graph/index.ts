import type { OperationalEntityType, OperationalLink } from "../operations/index.js";

export type OperatingGraphNodeType =
  | OperationalEntityType
  | "audience"
  | "offer"
  | "knowledge_item"
  | "media_asset"
  | "connector"
  | "agent"
  | "policy";

export interface OperatingGraphNode {
  readonly id: string;
  readonly workspaceId: string;
  readonly type: OperatingGraphNodeType;
}

export interface OperatingGraphLink extends Omit<OperationalLink, "fromType" | "toType"> {
  readonly fromType: OperatingGraphNodeType;
  readonly toType: OperatingGraphNodeType;
}

export interface OperatingGraph {
  readonly workspaceId: string;
  readonly nodes: readonly OperatingGraphNode[];
  readonly links: readonly OperatingGraphLink[];
}

export type GraphIssueCode =
  | "duplicate_node"
  | "duplicate_link"
  | "cross_workspace_node"
  | "dangling_link"
  | "cross_workspace_link"
  | "self_link"
  | "invalid_relation";

export interface GraphIssue {
  readonly code: GraphIssueCode;
  readonly message: string;
  readonly link?: OperatingGraphLink;
  readonly node?: OperatingGraphNode;
}

export interface GraphValidationResult {
  readonly valid: boolean;
  readonly issues: readonly GraphIssue[];
}

const RELATION_PATTERN = /^[a-z][a-z0-9_.-]*$/;

function nodeKey(node: Pick<OperatingGraphNode, "type" | "id">): string {
  return node.type + ":" + node.id;
}

function linkKey(link: OperatingGraphLink): string {
  return [
    link.fromType,
    link.fromId,
    link.toType,
    link.toId,
    link.relation,
  ].join(":");
}

export function validateOperatingGraph(
  graph: OperatingGraph,
): GraphValidationResult {
  const issues: GraphIssue[] = [];
  const nodes = new Map<string, OperatingGraphNode>();

  for (const node of graph.nodes) {
    const key = nodeKey(node);
    if (nodes.has(key)) {
      issues.push({
        code: "duplicate_node",
        message: `Duplicate graph node: ${key}`,
        node,
      });
      continue;
    }
    if (node.workspaceId !== graph.workspaceId) {
      issues.push({
        code: "cross_workspace_node",
        message: `Node ${key} belongs to workspace ${node.workspaceId}, not ${graph.workspaceId}`,
        node,
      });
    }
    nodes.set(key, node);
  }

  const links = new Set<string>();
  for (const link of graph.links) {
    const key = linkKey(link);
    if (links.has(key)) {
      issues.push({
        code: "duplicate_link",
        message: `Duplicate graph link: ${key}`,
        link,
      });
    }
    links.add(key);

    if (!RELATION_PATTERN.test(link.relation)) {
      issues.push({
        code: "invalid_relation",
        message: `Invalid graph relation: ${link.relation}`,
        link,
      });
    }

    const fromKey = link.fromType + ":" + link.fromId;
    const toKey = link.toType + ":" + link.toId;
    const from = nodes.get(fromKey);
    const to = nodes.get(toKey);

    if (!from || !to) {
      issues.push({
        code: "dangling_link",
        message: `Dangling graph link: ${fromKey} -> ${toKey}`,
        link,
      });
      continue;
    }

    if (from.workspaceId !== graph.workspaceId || to.workspaceId !== graph.workspaceId) {
      issues.push({
        code: "cross_workspace_link",
        message: `Graph link crosses the workspace boundary: ${fromKey} -> ${toKey}`,
        link,
      });
    }

    if (fromKey === toKey) {
      issues.push({
        code: "self_link",
        message: `Self-link is not allowed: ${fromKey}`,
        link,
      });
    }
  }

  return { valid: issues.length === 0, issues };
}

export function addGraphLink(
  graph: OperatingGraph,
  link: OperatingGraphLink,
): OperatingGraph {
  const next: OperatingGraph = {
    ...graph,
    links: [...graph.links, link],
  };
  const validation = validateOperatingGraph(next);
  if (!validation.valid) {
    throw new Error(validation.issues.map((issue) => issue.message).join("; "));
  }
  return next;
}

export function getNode(
  graph: OperatingGraph,
  type: OperatingGraphNodeType,
  id: string,
): OperatingGraphNode | undefined {
  return graph.nodes.find((node) => node.type === type && node.id === id);
}

export function getRelatedNodes(
  graph: OperatingGraph,
  node: Pick<OperatingGraphNode, "type" | "id">,
  direction: "inbound" | "outbound" | "both" = "both",
): OperatingGraphNode[] {
  const keys = new Set<string>();

  for (const link of graph.links) {
    const outbound =
      link.fromType === node.type && link.fromId === node.id;
    const inbound =
      link.toType === node.type && link.toId === node.id;

    if ((direction === "outbound" || direction === "both") && outbound) {
      keys.add(link.toType + ":" + link.toId);
    }
    if ((direction === "inbound" || direction === "both") && inbound) {
      keys.add(link.fromType + ":" + link.fromId);
    }
  }

  return graph.nodes.filter((candidate) =>
    keys.has(candidate.type + ":" + candidate.id),
  );
}

export function findOrphanNodes(
  graph: OperatingGraph,
  types?: readonly OperatingGraphNodeType[],
): OperatingGraphNode[] {
  const connected = new Set<string>();
  for (const link of graph.links) {
    connected.add(link.fromType + ":" + link.fromId);
    connected.add(link.toType + ":" + link.toId);
  }

  return graph.nodes.filter((node) => {
    if (types && !types.includes(node.type)) return false;
    return !connected.has(nodeKey(node));
  });
}

/**
 * The canonical business-flow vocabulary used by ORBIT's operating model.
 * This is a recognized lineage, not a requirement that every campaign contain
 * every node in the chain.
 */
export const CANONICAL_OPERATING_FLOW: readonly OperatingGraphNodeType[] = [
  "strategy",
  "campaign",
  "content",
  "task",
  "conversation",
  "contact",
  "opportunity",
  "insight",
];

export function isCanonicalOperatingFlow(
  types: readonly OperatingGraphNodeType[],
): boolean {
  let lastIndex = -1;
  for (const type of types) {
    const index = CANONICAL_OPERATING_FLOW.indexOf(type);
    if (index < 0 || index < lastIndex) return false;
    lastIndex = index;
  }
  return true;
}
