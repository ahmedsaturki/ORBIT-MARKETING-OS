export type SearchResultKind =
  | "campaign"
  | "content"
  | "contact"
  | "conversation"
  | "opportunity"
  | "work"
  | "strategy"
  | "knowledge"
  | "agent"
  | "policy"
  | "experiment"
  | "research_brief"
  | "research_finding";

export interface GlobalSearchResult {
  readonly kind: SearchResultKind;
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly score: number;
}

export const MAX_GLOBAL_SEARCH_RESULTS = 50;

export interface GlobalSearchQuery {
  readonly query: string;
  readonly limit?: number;
}

export function normalizeGlobalSearchQuery(input: GlobalSearchQuery): {
  readonly query: string;
  readonly limit: number;
} {
  const query = input.query.trim();
  if (!query) throw new Error("global_search_query_required");
  if (query.length > 200) throw new Error("global_search_query_too_long");

  return {
    query,
    limit: Math.min(
      MAX_GLOBAL_SEARCH_RESULTS,
      Math.max(1, Math.floor(input.limit ?? 25)),
    ),
  };
}

export function rankGlobalSearchResults(
  results: readonly GlobalSearchResult[],
): readonly GlobalSearchResult[] {
  return [...results]
    .map((result) => ({
      ...result,
      title: result.title.trim(),
      subtitle: result.subtitle.trim(),
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.title.localeCompare(right.title) ||
        left.kind.localeCompare(right.kind) ||
        left.id.localeCompare(right.id),
    );
}
