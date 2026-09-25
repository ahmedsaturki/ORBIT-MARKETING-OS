import { describe, expect, it } from "vitest";
import { buildGroundedKnowledgeContext } from "./context.js";

const source = {
  id: "source-1",
  workspaceId: "ws-1",
  type: "document" as const,
  title: "Brand rules",
  collectedAt: "2026-09-25T00:00:00Z",
};

const item = {
  id: "item-1",
  workspaceId: "ws-1",
  statement: "The approved brand promise is evidence-led growth.",
  sourceIds: ["source-1"],
  trust: "verified" as const,
  tags: ["brand"],
  createdAt: "2026-09-25T00:00:00Z",
  updatedAt: "2026-09-25T00:00:00Z",
};

describe("grounded knowledge context", () => {
  it("keeps only usable in-workspace evidence", () => {
    const result = buildGroundedKnowledgeContext(
      "ws-1",
      [
        item,
        { ...item, id: "unverified", trust: "unverified" },
        { ...item, id: "other-workspace", workspaceId: "ws-2" },
        { ...item, id: "expired", expiresAt: "2026-01-01T00:00:00Z" },
      ],
      [source],
      { now: "2026-09-25T20:00:00Z" },
    );

    expect(result.items.map((entry) => entry.id)).toEqual(["item-1"]);
    expect(result.sources).toEqual([source]);
  });

  it("respects item and character budgets deterministically", () => {
    const result = buildGroundedKnowledgeContext(
      "ws-1",
      [
        item,
        {
          ...item,
          id: "item-2",
          statement: "Second grounded statement.",
        },
      ],
      [source],
      { maxItems: 1, maxCharacters: 1000 },
    );

    expect(result.items.map((entry) => entry.id)).toEqual(["item-1"]);
    expect(result.truncated).toBe(true);
  });

  it("rejects invalid context identity or timestamp", () => {
    expect(() => buildGroundedKnowledgeContext("", [item], [source])).toThrow(
      "knowledge_context_workspace_required",
    );

    expect(() =>
      buildGroundedKnowledgeContext("ws-1", [item], [source], {
        now: "not-a-date",
      }),
    ).toThrow("knowledge_context_invalid_timestamp");
  });

  it("does not use evidence whose source belongs to another workspace", () => {
    expect(
      buildGroundedKnowledgeContext(
        "ws-1",
        [item],
        [{ ...source, workspaceId: "ws-2" }],
      ).items,
    ).toEqual([]);
  });
});
