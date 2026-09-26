export type ResearchKind =
  | "competitor"
  | "market"
  | "audience"
  | "content"
  | "channel"
  | "offer"
  | "customer_voice"
  | "general";

export type ResearchStatus = "draft" | "active" | "completed" | "archived";

export interface ResearchBrief {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly kind: ResearchKind;
  readonly question: string;
  readonly objectives: readonly string[];
  readonly status: ResearchStatus;
}

export interface ResearchFinding {
  readonly id: string;
  readonly workspaceId: string;
  readonly briefId: string;
  readonly title: string;
  readonly statement: string;
  readonly sourceIds: readonly string[];
  readonly confidence: number;
  readonly observedAt: string;
  readonly expiresAt?: string;
  readonly tags: readonly string[];
}

export interface ResearchValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export function validateResearchBrief(
  brief: ResearchBrief,
): ResearchValidationResult {
  const errors: string[] = [];
  if (!brief.id.trim()) errors.push("id_required");
  if (!brief.workspaceId.trim()) errors.push("workspace_required");
  if (!brief.name.trim()) errors.push("name_required");
  if (
    ![
      "competitor",
      "market",
      "audience",
      "content",
      "channel",
      "offer",
      "customer_voice",
      "general",
    ].includes(brief.kind)
  ) {
    errors.push("invalid_kind");
  }
  if (!brief.question.trim()) errors.push("question_required");
  if (brief.objectives.some((item) => !item.trim())) {
    errors.push("invalid_objective");
  }
  if (!["draft", "active", "completed", "archived"].includes(brief.status)) {
    errors.push("invalid_status");
  }
  return { valid: errors.length === 0, errors };
}

export function validateResearchFinding(
  finding: ResearchFinding,
): ResearchValidationResult {
  const errors: string[] = [];
  if (!finding.id.trim()) errors.push("id_required");
  if (!finding.workspaceId.trim()) errors.push("workspace_required");
  if (!finding.briefId.trim()) errors.push("brief_required");
  if (!finding.title.trim()) errors.push("title_required");
  if (!finding.statement.trim()) errors.push("statement_required");
  if (finding.sourceIds.length === 0) errors.push("source_required");
  if (finding.sourceIds.some((id) => !id.trim())) {
    errors.push("invalid_source");
  }
  if (
    !Number.isFinite(finding.confidence) ||
    finding.confidence < 0 ||
    finding.confidence > 1
  ) {
    errors.push("invalid_confidence");
  }
  if (
    !finding.observedAt.trim() ||
    Number.isNaN(Date.parse(finding.observedAt))
  ) {
    errors.push("invalid_observed_at");
  }
  if (finding.expiresAt && Number.isNaN(Date.parse(finding.expiresAt))) {
    errors.push("invalid_expires_at");
  }
  return { valid: errors.length === 0, errors };
}

export function rankResearchFindings(
  findings: readonly ResearchFinding[],
): readonly ResearchFinding[] {
  return [...findings].sort(
    (left, right) =>
      right.confidence - left.confidence ||
      Date.parse(right.observedAt) - Date.parse(left.observedAt) ||
      left.title.localeCompare(right.title) ||
      left.id.localeCompare(right.id),
  );
}

export function researchFindingToKnowledgeStatement(
  finding: ResearchFinding,
): string {
  const validation = validateResearchFinding(finding);
  if (!validation.valid) {
    throw new Error("invalid_research_finding");
  }
  return finding.statement.trim();
}
