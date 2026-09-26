export type SearchResultKind =
  | "campaign"
  | "account"
  | "content"
  | "contact"
  | "conversation"
  | "message"
  | "opportunity"
  | "work"
  | "strategy"
  | "knowledge"
  | "knowledge_source"
  | "media_asset"
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
  if ([...query].length > 200) throw new Error("global_search_query_too_long");
  if ([...query].some((character) => /\\p{Cc}/u.test(character))) {
    throw new Error("global_search_query_invalid_control_character");
  }

  const requestedLimit = input.limit ?? 25;
  if (!Number.isFinite(requestedLimit)) {
    throw new Error("global_search_limit_invalid");
  }

  return {
    query,
    limit: Math.min(
      MAX_GLOBAL_SEARCH_RESULTS,
      Math.max(1, Math.floor(requestedLimit)),
    ),
  };
}

function compareDeterministically(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
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
        compareDeterministically(left.title, right.title) ||
        compareDeterministically(left.kind, right.kind) ||
        compareDeterministically(left.id, right.id),
    );
}
