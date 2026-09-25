export type KnowledgeSourceType =
  | "document"
  | "website"
  | "crm"
  | "campaign"
  | "analytics"
  | "research"
  | "user";

export type KnowledgeTrust =
  "verified" | "approved" | "observed" | "unverified";

export interface KnowledgeSource {
  readonly id: string;
  readonly workspaceId: string;
  readonly type: KnowledgeSourceType;
  readonly title: string;
  readonly locator?: string;
  readonly collectedAt: string;
}

export interface KnowledgeItem {
  readonly id: string;
  readonly workspaceId: string;
  readonly statement: string;
  readonly sourceIds: readonly string[];
  readonly trust: KnowledgeTrust;
  readonly tags: readonly string[];
  readonly expiresAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface KnowledgeEvidence {
  readonly itemId: string;
  readonly sourceId: string;
  readonly excerptHash: string;
  readonly collectedAt: string;
}

export function isUsableKnowledge(item: KnowledgeItem): boolean {
  return (
    item.trust !== "unverified" &&
    item.statement.trim().length > 0 &&
    item.sourceIds.length > 0
  );
}

export function rankKnowledgeSources(
  items: readonly KnowledgeItem[],
  preferredTrust: readonly KnowledgeTrust[] = [
    "verified",
    "approved",
    "observed",
  ],
): KnowledgeItem[] {
  const rank = new Map(
    preferredTrust.map((trust, index) => [
      trust,
      preferredTrust.length - index,
    ]),
  );
  return [...items].sort(
    (a, b) => (rank.get(b.trust) ?? 0) - (rank.get(a.trust) ?? 0),
  );
}
