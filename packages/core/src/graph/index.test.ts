import { describe, expect, it } from "vitest";
import {
  addGraphLink,
  findOrphanNodes,
  getRelatedNodes,
  isCanonicalOperatingFlow,
  validateOperatingGraph,
  type OperatingGraph,
} from "./index.js";

const node = (type: OperatingGraph["nodes"][number]["type"], id: string) => ({
  type,
  id,
  workspaceId: "ws-1",
});

describe("operating graph kernel", () => {
  it("validates workspace ownership and rejects dangling/self links", () => {
    const graph: OperatingGraph = {
      workspaceId: "ws-1",
      nodes: [node("strategy", "s-1"), node("campaign", "c-1")],
      links: [
        {
          workspaceId: "ws-1",
          fromType: "strategy",
          fromId: "s-1",
          toType: "campaign",
          toId: "missing",
          relation: "contains",
        },
        {
          workspaceId: "ws-1",
          fromType: "campaign",
          fromId: "c-1",
          toType: "campaign",
          toId: "c-1",
          relation: "contains",
        },
      ],
    };

    const result = validateOperatingGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "dangling_link",
      "self_link",
    ]);
  });

  it("rejects duplicate nodes and links", () => {
    const campaign = node("campaign", "c-1");
    const graph: OperatingGraph = {
      workspaceId: "ws-1",
      nodes: [campaign, campaign],
      links: [
        {
          workspaceId: "ws-1",
          fromType: "campaign",
          fromId: "c-1",
          toType: "strategy",
          toId: "s-1",
          relation: "supports",
        },
        {
          workspaceId: "ws-1",
          fromType: "campaign",
          fromId: "c-1",
          toType: "strategy",
          toId: "s-1",
          relation: "supports",
        },
      ],
    };

    const result = validateOperatingGraph(graph);
    expect(result.issues.map((issue) => issue.code)).toContain("duplicate_node");
    expect(result.issues.map((issue) => issue.code)).toContain("duplicate_link");
  });

  it("supports immutable link insertion with validation", () => {
    const base: OperatingGraph = {
      workspaceId: "ws-1",
      nodes: [node("strategy", "s-1"), node("campaign", "c-1")],
      links: [],
    };

    const next = addGraphLink(base, {
      workspaceId: "ws-1",
      fromType: "strategy",
      fromId: "s-1",
      toType: "campaign",
      toId: "c-1",
      relation: "supports",
    });

    expect(base.links).toHaveLength(0);
    expect(next.links).toHaveLength(1);
  });

  it("returns only connected neighbors for the requested direction", () => {
    const graph: OperatingGraph = {
      workspaceId: "ws-1",
      nodes: [
        node("strategy", "s-1"),
        node("campaign", "c-1"),
        node("content", "content-1"),
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
      ],
    };

    expect(getRelatedNodes(graph, node("campaign", "c-1"), "inbound").map((x) => x.type))
      .toEqual(["strategy"]);
    expect(getRelatedNodes(graph, node("campaign", "c-1"), "outbound").map((x) => x.type))
      .toEqual(["content"]);
  });

  it("finds orphan nodes without guessing how to repair them", () => {
    const graph: OperatingGraph = {
      workspaceId: "ws-1",
      nodes: [
        node("strategy", "s-1"),
        node("campaign", "c-1"),
        node("contact", "contact-1"),
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
      ],
    };

    expect(findOrphanNodes(graph).map((x) => x.id)).toEqual(["contact-1"]);
    expect(findOrphanNodes(graph, ["strategy", "campaign"])).toEqual([]);
  });

  it("recognizes the canonical strategy-to-learning order", () => {
    expect(
      isCanonicalOperatingFlow([
        "strategy",
        "campaign",
        "content",
        "task",
        "conversation",
        "contact",
        "opportunity",
        "insight",
      ]),
    ).toBe(true);
    expect(isCanonicalOperatingFlow(["campaign", "strategy"])).toBe(false);
    expect(isCanonicalOperatingFlow(["strategy", "content", "campaign"])).toBe(
      false,
    );
  });
});
