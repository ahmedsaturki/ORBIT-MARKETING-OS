import {
  isUsableKnowledge,
  rankKnowledgeSources,
  type KnowledgeItem,
  type KnowledgeSource,
} from "./index.js";

export interface KnowledgeContextOptions {
  readonly maxItems?: number;
  readonly maxCharacters?: number;
  readonly now?: string;
}

export interface GroundedKnowledgeContext {
  readonly workspaceId: string;
  readonly items: readonly KnowledgeItem[];
  readonly sources: readonly KnowledgeSource[];
  readonly truncated: boolean;
}

/**
 * Builds a bounded evidence context for AI/agent consumers. Unverified,
 * cross-workspace, and expired items are excluded before budgeting context.
 */
export function buildGroundedKnowledgeContext(
  workspaceId: string,
  items: readonly KnowledgeItem[],
  sources: readonly KnowledgeSource[],
  options: KnowledgeContextOptions = {},
): GroundedKnowledgeContext {
  if (!workspaceId.trim()) {
    throw new Error("knowledge_context_workspace_required");
  }

  const now = options.now ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(now))) {
    throw new Error("knowledge_context_invalid_timestamp");
  }

  const sourceMap = new Map(
    sources
      .filter((source) => source.workspaceId === workspaceId)
      .map((source) => [source.id, source]),
  );

  const eligible = rankKnowledgeSources(
    items.filter((item) => {
      if (item.workspaceId !== workspaceId || !isUsableKnowledge(item)) {
        return false;
      }
      if (item.expiresAt && Date.parse(item.expiresAt) <= Date.parse(now)) {
        return false;
      }
      return item.sourceIds.some((sourceId) => sourceMap.has(sourceId));
    }),
  );

  const maxItems = Math.max(1, Math.floor(options.maxItems ?? 20));
  const maxCharacters = Math.max(
    100,
    Math.floor(options.maxCharacters ?? 12000),
  );

  const selected: KnowledgeItem[] = [];
  let characters = 0;
  let truncated = false;

  for (const item of eligible) {
    const nextCharacters = characters + item.statement.length;
    if (selected.length >= maxItems || nextCharacters > maxCharacters) {
      truncated = true;
      continue;
    }
    selected.push(item);
    characters = nextCharacters;
  }

  const selectedSourceIds = new Set(selected.flatMap((item) => item.sourceIds));
  const selectedSources = sources.filter(
    (source) =>
      source.workspaceId === workspaceId && selectedSourceIds.has(source.id),
  );

  return {
    workspaceId,
    items: selected,
    sources: selectedSources,
    truncated,
  };
}
