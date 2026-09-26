import { describe, expect, it } from "vitest";
import {
  rankResearchFindings,
  researchFindingToKnowledgeStatement,
  validateResearchBrief,
  validateResearchFinding,
  type ResearchFinding,
} from "../src/research/index.js";

describe("research intelligence primitives", () => {
  it("validates research briefs and findings", () => {
    expect(
      validateResearchBrief({
        id: "brief-1",
        workspaceId: "ws-1",
        name: "Competitor scan",
        kind: "competitor",
        question: "What changed?",
        objectives: ["surface differences"],
        status: "active",
      }).valid,
    ).toBe(true);

    expect(
      validateResearchFinding({
        id: "finding-1",
        workspaceId: "ws-1",
        briefId: "brief-1",
        title: "Proof",
        statement: "Customers value transparent delivery evidence.",
        sourceIds: ["source-1"],
        confidence: 0.8,
        observedAt: "2026-09-26T09:00:00Z",
        tags: ["trust"],
      }).valid,
    ).toBe(true);
  });

  it("rejects unsupported or ungrounded findings", () => {
    expect(
      validateResearchFinding({
        id: "finding-1",
        workspaceId: "ws-1",
        briefId: "brief-1",
        title: "No source",
        statement: "Claim",
        sourceIds: [],
        confidence: 0.8,
        observedAt: "2026-09-26T09:00:00Z",
        tags: [],
      }).errors,
    ).toContain("source_required");

    expect(
      validateResearchBrief({
        id: "brief-1",
        workspaceId: "ws-1",
        name: "Bad",
        kind: "unknown" as never,
        question: "Q",
        objectives: [],
        status: "active",
      }).errors,
    ).toContain("invalid_kind");
  });

  it("ranks deterministically and preserves an evidence-first contract", () => {
    const findings: ResearchFinding[] = [
      {
        id: "b",
        workspaceId: "ws-1",
        briefId: "brief-1",
        title: "Older",
        statement: "B",
        sourceIds: ["source-b"],
        confidence: 0.7,
        observedAt: "2026-09-25T09:00:00Z",
        tags: [],
      },
      {
        id: "a",
        workspaceId: "ws-1",
        briefId: "brief-1",
        title: "Newer",
        statement: "A",
        sourceIds: ["source-a"],
        confidence: 0.9,
        observedAt: "2026-09-26T09:00:00Z",
        tags: [],
      },
    ];

    expect(rankResearchFindings([...findings])).toEqual(
      rankResearchFindings([...findings].reverse()),
    );
    expect(rankResearchFindings(findings)[0]?.id).toBe("a");
    expect(researchFindingToKnowledgeStatement(findings[1]!)).toBe("B");
  });
});
