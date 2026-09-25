import type { ActionRisk, AutonomyMode, MarketingExecutionPolicy } from "../policies/index.js";

export type PolicyPackId =
  | "conservative"
  | "balanced"
  | "agency"
  | "enterprise"
  | "regulated";

export interface PolicyPack {
  readonly id: PolicyPackId;
  readonly name: string;
  readonly description: string;
  readonly policy: Omit<MarketingExecutionPolicy, "id" | "workspaceId" | "name">;
}

const SAFETY_BLOCKS = [
  "captcha_bypass",
  "fingerprint_spoofing",
  "stealth_evasion",
  "credential_exfiltration",
  "unauthorized_bulk_action",
  "impersonation",
] as const;

function pack(
  id: PolicyPackId,
  name: string,
  description: string,
  mode: AutonomyMode,
  maxDailyExternalActions: number,
  requireApprovalFor: readonly ActionRisk[],
): PolicyPack {
  return {
    id,
    name,
    description,
    policy: {
      mode,
      allowedActions: [
        "draft",
        "review",
        "analyze",
        "publish",
        "reply",
        "send_message",
      ],
      blockedActions: SAFETY_BLOCKS,
      maxDailyExternalActions,
      requireApprovalFor,
    },
  };
}

export const BUILT_IN_POLICY_PACKS: readonly PolicyPack[] = [
  pack(
    "conservative",
    "Conservative",
    "Human-led operating policy with explicit approval for externally visible work.",
    "manual",
    10,
    ["medium", "high", "critical"],
  ),
  pack(
    "balanced",
    "Balanced",
    "Bounded automation with approvals for elevated-risk actions.",
    "bounded",
    25,
    ["high", "critical"],
  ),
  pack(
    "agency",
    "Agency",
    "Multi-client operating policy for higher-volume governed execution.",
    "bounded",
    50,
    ["high", "critical"],
  ),
  pack(
    "enterprise",
    "Enterprise",
    "Governed execution with explicit approval for every high-impact action.",
    "approved",
    100,
    ["high", "critical"],
  ),
  pack(
    "regulated",
    "Regulated",
    "Audit-oriented policy with strict approval requirements for medium and higher risk.",
    "approved",
    20,
    ["medium", "high", "critical"],
  ),
];

export function getPolicyPack(id: PolicyPackId): PolicyPack {
  const result = BUILT_IN_POLICY_PACKS.find((item) => item.id === id);
  if (!result) throw new Error("policy_pack_not_found");
  return result;
}

export function materializePolicyPack(
  id: PolicyPackId,
  workspaceId: string,
  policyId: string,
): MarketingExecutionPolicy {
  const selected = getPolicyPack(id);
  if (!workspaceId.trim() || !policyId.trim()) {
    throw new Error("policy_pack_identity_required");
  }

  return {
    id: policyId,
    workspaceId,
    name: selected.name,
    ...selected.policy,
  };
}
