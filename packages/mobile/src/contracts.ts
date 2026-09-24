/**
 * Shared domain contracts for the mobile monitoring surface.
 *
 * The mobile app does not duplicate domain semantics: it type-only imports
 * the core unions from packages/core so any drift fails this package's
 * typecheck (see the Assert<Eq<...>> guards below).
 */
import type {
  ApprovalStatus,
  CircuitState,
  PolicyDecisionReason,
  TaskActionType,
  TaskStatus,
} from "../../core/src/types/index";

export type {
  ApprovalStatus,
  CircuitState,
  PolicyDecisionReason,
  TaskActionType,
  TaskStatus,
};

export const TASK_STATUSES = [
  "queued",
  "running",
  "completed",
  "failed",
  "retrying",
  "cancelled",
  "blocked",
] as const;

export const APPROVAL_STATUSES = [
  "draft",
  "pending",
  "approved",
  "rejected",
  "changes_requested",
] as const;

export const CIRCUIT_STATES = ["closed", "open", "half_open"] as const;

export const POLICY_REASONS = [
  "allowed",
  "daily_limit",
  "account_paused",
  "account_restricted",
  "challenge_active",
  "circuit_open",
  "approval_required",
] as const;

export const TASK_ACTION_TYPES = [
  "post_group",
  "post_page",
  "send_dm",
  "comment",
  "follow",
  "like",
  "whatsapp_msg",
  "telegram_post",
] as const;

type Eq<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;

export type ContractsStayAligned = Assert<Eq<TaskStatus, (typeof TASK_STATUSES)[number]>> &
  Assert<Eq<ApprovalStatus, (typeof APPROVAL_STATUSES)[number]>> &
  Assert<Eq<CircuitState, (typeof CIRCUIT_STATES)[number]>> &
  Assert<Eq<PolicyDecisionReason, (typeof POLICY_REASONS)[number]>> &
  Assert<Eq<TaskActionType, (typeof TASK_ACTION_TYPES)[number]>>;
