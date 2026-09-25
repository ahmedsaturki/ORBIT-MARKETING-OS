import { describe, expect, it } from "vitest";
import { projectGraphContext, type GraphContext } from "./context.js";
import type { OperatingGraph } from "./index.js";

const graph: OperatingGraph = {
  workspaceId: "ws-1",
  nodes: [
    { id: "s-1", type: "strategy", workspaceId: "ws-1" },
    { id: "c-1", type: "campaign", workspaceId: "ws-1" },
    { id: "content-1", type: "content", workspaceId: "ws-1" },
    { id: "task-1", type: "task", workspaceId: "ws-1" },
    { id: "lead-1", type: "contact", workspaceId: "ws-1" },
  ],
  links: [
    {
      workspaceId: "ws-1",
      fromType: "strategy",
      fromId: "s-1",
      toType: "campaign",
      toId: "c-1",
      relation: "supports",
    },
    {
      workspaceId: "ws-1",
      fromType: "campaign",
      fromId: "c-1",
      toType: "content",
      toId: "content-1",
      relation: "produces",
    },
    {
      workspaceId: "ws-1",
      fromType: "content",
      fromId: "content-1",
      toType: "task",
      toId: "task-1",
      relation: "executes",
    },
    {
      workspaceId: "ws-1",
      fromType: "task",
      fromId: "task-1",
      toType: "contact",
      toId: "lead-1",
      relation: "engages",
    },
  ],
};

describe("bounded operating graph context", () => {
  it("stops at the requested depth", () => {
    const context = projectGraphContext(
      graph,
      {
        type: "campaign",
        id: "c-1",
      },
      { maxDepth: 1 },
    );

    expect(context.depth).toBe(1);
    expect(context.nodes.map((node) => node.type)).toEqual([
      "strategy",
      "campaign",
      "content",
    ]);
  });

  it("stops at the node budget and reports truncation", () => {
    const context: GraphContext = projectGraphContext(
      graph,
      {
        type: "strategy",
        id: "s-1",
      },
      { maxDepth: 4, maxNodes: 2 },
    );

    expect(context.nodes).toHaveLength(2);
    expect(context.truncated).toBe(true);
  });

  it("can scope context to a relation allowlist", () => {
    const context = projectGraphContext(
      graph,
      {
        type: "campaign",
        id: "c-1",
      },
      { maxDepth: 4, relations: ["produces"] },
    );

    expect(context.nodes.map((node) => node.id)).toEqual(["c-1", "content-1"]);
    expect(context.links).toHaveLength(1);
  });

  it("rejects roots that belong to another workspace", () => {
    const graphWithForeignRoot: OperatingGraph = {
      ...graph,
      nodes: [
        ...graph.nodes,
        { id: "foreign", type: "strategy", workspaceId: "ws-2" },
      ],
    };

    expect(() =>
      projectGraphContext(graphWithForeignRoot, {
        type: "strategy",
        id: "foreign",
      }),
    ).toThrow("graph_root_workspace_mismatch");
  });

  it("rejects unknown roots instead of silently returning empty context", () => {
    expect(() =>
      projectGraphContext(graph, { type: "campaign", id: "missing" }),
    ).toThrow("graph_root_not_found");
  });
});
