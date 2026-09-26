import { describe, expect, it } from "vitest";
import {
  MAX_GLOBAL_SEARCH_RESULTS,
  normalizeGlobalSearchQuery,
  rankGlobalSearchResults,
  type GlobalSearchResult,
} from "./index.js";

describe("global search contract", () => {
  it("normalizes a bounded query and result limit", () => {
    expect(
      normalizeGlobalSearchQuery({ query: "  campaign  ", limit: 999 }),
    ).toEqual({ query: "campaign", limit: MAX_GLOBAL_SEARCH_RESULTS });
  });

  it("rejects empty, oversized and control-character queries", () => {
    expect(() => normalizeGlobalSearchQuery({ query: "   " })).toThrow(
      "global_search_query_required",
    );
    expect(() =>
      normalizeGlobalSearchQuery({ query: "x".repeat(201) }),
    ).toThrow("global_search_query_too_long");
    expect(() => normalizeGlobalSearchQuery({ query: "line\nfeed" })).toThrow(
      "global_search_query_invalid_control_character",
    );
  });

  it("counts Unicode code points and rejects invalid limits", () => {
    const emojiQuery = "🙂".repeat(150);
    expect(normalizeGlobalSearchQuery({ query: emojiQuery }).query).toBe(
      emojiQuery,
    );
    expect(() =>
      normalizeGlobalSearchQuery({ query: "campaign", limit: Number.NaN }),
    ).toThrow("global_search_limit_invalid");
  });

  it("produces deterministic ranking independent of input order", () => {
    const results: GlobalSearchResult[] = [
      {
        kind: "contact",
        id: "b",
        title: "Beta",
        subtitle: "contact",
        score: 70,
      },
      {
        kind: "campaign",
        id: "a",
        title: "Alpha",
        subtitle: "campaign",
        score: 100,
      },
      {
        kind: "content",
        id: "a",
        title: "Alpha",
        subtitle: "content",
        score: 100,
      },
    ];

    expect(rankGlobalSearchResults(results).map((item) => item.kind)).toEqual([
      "campaign",
      "content",
      "contact",
    ]);
    expect(rankGlobalSearchResults([...results].reverse())).toEqual(
      rankGlobalSearchResults(results),
    );
  });
});
