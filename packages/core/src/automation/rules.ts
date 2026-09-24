import type { Platform, TaskKind } from "../types/index.js";

export interface AutomationRule {
  readonly id: string;
  readonly platform: Platform;
  readonly taskKinds: readonly TaskKind[];
  readonly enabled: boolean;
  readonly requiresConfirmation: boolean;
  readonly maxAttempts: number;
  readonly timeoutMs: number;
}

export interface AutomationRulePack {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly platform: Platform;
  readonly version: string;
  readonly rules: readonly AutomationRule[];
}

export interface RulePackValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

const TASK_KINDS: readonly TaskKind[] = ["publish", "message", "comment", "sync", "engage"];

export function validateAutomationRulePack(
  pack: AutomationRulePack,
): RulePackValidationResult {
  const errors: string[] = [];
  if (pack.schemaVersion !== 1) errors.push("unsupported rule pack schema version");
  if (!pack.id.trim()) errors.push("rule pack id is required");
  if (!pack.version.trim()) errors.push("rule pack version is required");
  if (pack.rules.length === 0) errors.push("rule pack must contain at least one rule");
  const ruleIds = new Set<string>();

  for (const rule of pack.rules) {
    if (!rule.id.trim()) errors.push("rule id is required");
    if (ruleIds.has(rule.id)) errors.push("rule ids must be unique");
    ruleIds.add(rule.id);

    if (rule.platform !== pack.platform) errors.push("rule platform must match rule pack platform");
    if (rule.taskKinds.some((kind) => !TASK_KINDS.includes(kind))) {
      errors.push("rule contains unsupported task kind");
    }
    if (rule.taskKinds.length === 0) errors.push("rule must target at least one task kind");
    if (rule.enabled && rule.taskKinds.some((kind) => kind !== "sync") && !rule.requiresConfirmation) {
      errors.push("enabled external rules must require confirmation");
    }
    if (!Number.isInteger(rule.maxAttempts) || rule.maxAttempts < 1 || rule.maxAttempts > 10) {
      errors.push("rule maxAttempts must be between 1 and 10");
    }
    if (!Number.isInteger(rule.timeoutMs) || rule.timeoutMs < 1000 || rule.timeoutMs > 300000) {
      errors.push("rule timeoutMs must be between 1000 and 300000");
    }
  }

  return { valid: errors.length === 0, errors };
}

export function resolveAutomationRule(
  pack: AutomationRulePack,
  taskKind: TaskKind,
): AutomationRule | undefined {
  return pack.rules.find(
    (rule) => rule.enabled && rule.taskKinds.includes(taskKind),
  );
}
