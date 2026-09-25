export type NextActionKind =
  | "human_intervention"
  | "approval"
  | "failed_work"
  | "overdue_work"
  | "follow_up"
  | "blocked_work";

export type NextActionPriority = "urgent" | "high" | "normal" | "low";

export interface NextActionCandidate {
  readonly id: string;
  readonly workspaceId: string;
  readonly sourceId: string;
  readonly kind: NextActionKind;
  readonly title: string;
  readonly reason: string;
  readonly priority: NextActionPriority;
  readonly score: number;
}

export interface MissionControlInput {
  readonly workspaceId: string;
  readonly now: string;
  readonly interventions?: readonly { id: string; title: string }[];
  readonly approvals?: readonly { id: string; title: string }[];
  readonly failedWork?: readonly { id: string; title: string }[];
  readonly overdueWork?: readonly { id: string; title: string }[];
  readonly followUps?: readonly { id: string; title: string }[];
  readonly blockedWork?: readonly { id: string; title: string }[];
}

interface SourceItem {
  readonly id: string;
  readonly title: string;
}

interface Rule {
  readonly kind: NextActionKind;
  readonly score: number;
  readonly priority: NextActionPriority;
  readonly reason: string;
  readonly items: readonly SourceItem[];
}

const RULES: ReadonlyArray<(input: MissionControlInput) => Rule> = [
  (input) => ({
    kind: "human_intervention",
    score: 1000,
    priority: "urgent",
    reason: "User action is required before external work can resume.",
    items: input.interventions ?? [],
  }),
  (input) => ({
    kind: "approval",
    score: 900,
    priority: "urgent",
    reason:
      "An approval gate is preventing the governed workflow from progressing.",
    items: input.approvals ?? [],
  }),
  (input) => ({
    kind: "failed_work",
    score: 800,
    priority: "high",
    reason:
      "A previously attempted work item failed and needs diagnosis or recovery.",
    items: input.failedWork ?? [],
  }),
  (input) => ({
    kind: "overdue_work",
    score: 700,
    priority: "high",
    reason: "The work item is past its operational deadline.",
    items: input.overdueWork ?? [],
  }),
  (input) => ({
    kind: "follow_up",
    score: 600,
    priority: "normal",
    reason: "A customer or opportunity follow-up is due.",
    items: input.followUps ?? [],
  }),
  (input) => ({
    kind: "blocked_work",
    score: 500,
    priority: "normal",
    reason: "Work is blocked and needs an explicit resolution path.",
    items: input.blockedWork ?? [],
  }),
];

/**
 * Produces a deterministic, explainable Mission Control queue. This function
 * only ranks supplied work; it does not mutate state or execute external work.
 */
export function deriveNextActions(
  input: MissionControlInput,
): readonly NextActionCandidate[] {
  if (!input.workspaceId.trim()) {
    throw new Error("mission_control_workspace_required");
  }
  if (!input.now.trim() || Number.isNaN(Date.parse(input.now))) {
    throw new Error("mission_control_invalid_timestamp");
  }

  const result: NextActionCandidate[] = [];
  for (const ruleFactory of RULES) {
    const rule = ruleFactory(input);
    for (const item of rule.items) {
      if (!item.id.trim() || !item.title.trim()) continue;
      result.push({
        id: rule.kind + ":" + item.id,
        workspaceId: input.workspaceId,
        sourceId: item.id,
        kind: rule.kind,
        title: item.title,
        reason: rule.reason,
        priority: rule.priority,
        score: rule.score,
      });
    }
  }

  return result.sort(
    (left, right) =>
      right.score - left.score ||
      left.kind.localeCompare(right.kind) ||
      left.id.localeCompare(right.id),
  );
}
