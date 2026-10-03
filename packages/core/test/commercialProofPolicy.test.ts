import { describe, expect, it, vi } from "vitest";
import type { PlatformConnector } from "../src/connectors/contracts.js";
import { ConnectorRegistry } from "../src/connectors/registry.js";
import {
  DEFAULT_EXECUTION_CIRCUIT_BREAKER_THRESHOLD,
  DEFAULT_EXECUTION_DAILY_LIMIT,
  evaluateExecutionPolicy,
  type ExecutionPolicyContext,
} from "../src/workflows/executionPolicy.js";
import { ExecutionRunner } from "../src/workflows/executionRunner.js";
import type {
  Approval,
  Campaign,
  ContentItem,
  SocialAccount,
  Task,
} from "../src/types/index.js";

/**
 * Contract for the commercial connector proof harness fail-closed behavior:
 * the harness builds exactly this policy context (single deliberate proof
 * action, counters at zero, production default budgets) and must not invoke
 * connector.execute() when the decision is blocked. The copy lives here, not
 * in the script, so a regression in the gate is caught by the suite.
 */
const PROOF_WORKSPACE_ID = "commercial-proof";
const PROOF_CAMPAIGN_ID = "commercial-proof";

function proofContext(
  overrides: Partial<{
    campaign: Campaign;
    actionsToday: number;
    consecutiveFailures: number;
  }> = {},
): ExecutionPolicyContext & { task: Task & { contentId: string } } {
  const now = "2026-01-01T00:00:00.000Z";
  const account: SocialAccount = {
    id: "commercial-proof-telegram",
    workspaceId: PROOF_WORKSPACE_ID,
    platform: "telegram",
    displayName: "commercial-proof telegram",
    status: "connected",
    healthScore: 100,
    createdAt: now,
  };
  const task: Task & { contentId: string } = {
    id: "commercial-proof-telegram-task",
    workspaceId: PROOF_WORKSPACE_ID,
    campaignId: PROOF_CAMPAIGN_ID,
    accountId: "commercial-proof-telegram",
    platform: "telegram",
    kind: "publish",
    contentId: "commercial-proof-telegram-content",
    destinationId: "commercial-proof-destination",
    priority: 1,
    status: "running",
    attempts: 0,
    maxAttempts: 1,
    availableAt: now,
    idempotencyKey: "commercial-proof-telegram",
    createdAt: now,
  };
  const campaign: Campaign = overrides.campaign ?? {
    id: PROOF_CAMPAIGN_ID,
    workspaceId: PROOF_WORKSPACE_ID,
    name: "commercial-proof",
    status: "running",
    accountIds: [account.id],
    contentIds: [task.contentId],
    taskCount: 1,
    createdAt: now,
  };
  const content: ContentItem = {
    id: task.contentId,
    workspaceId: PROOF_WORKSPACE_ID,
    title: "commercial-proof",
    body: "ORBIT connector proof test — do not treat as customer-facing content.",
    platformVariants: {
      facebook: undefined,
      instagram: undefined,
      telegram: "ORBIT connector proof test",
      whatsapp: undefined,
      linkedin: undefined,
      tiktok: undefined,
    },
    approvalStatus: "approved",
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
  const approval: Approval = {
    id: "commercial-proof-approval-telegram",
    workspaceId: PROOF_WORKSPACE_ID,
    contentId: task.contentId,
    requestedBy: "commercial-proof-operator",
    reviewerIds: ["commercial-proof-operator"],
    status: "approved",
    decidedBy: "commercial-proof-operator",
    decidedAt: now,
    note: "--confirm-live operator confirmation",
  };
  return {
    account,
    campaign,
    task,
    content,
    approval,
    actionsToday: overrides.actionsToday ?? 0,
    dailyLimit: DEFAULT_EXECUTION_DAILY_LIMIT,
    consecutiveFailures: overrides.consecutiveFailures ?? 0,
    circuitBreakerThreshold: DEFAULT_EXECUTION_CIRCUIT_BREAKER_THRESHOLD,
  };
}

function spyConnector(): PlatformConnector & { executeCalls: number } {
  const connector = {
    platform: "telegram",
    capabilities: {
      publish: true,
      messaging: false,
      comments: false,
      inbox: false,
      analytics: false,
      media: false,
    },
    executeCalls: 0,
    async connect() {
      return { status: "succeeded", message: "connected" } as const;
    },
    async disconnect() {
      return { status: "succeeded", message: "disconnected" } as const;
    },
    async execute() {
      connector.executeCalls += 1;
      return { status: "succeeded", message: "sent" } as const;
    },
    async sync() {
      return { status: "succeeded", message: "synced" } as const;
    },
  } satisfies PlatformConnector & { executeCalls: number };
  return connector;
}

async function runWithSpy(context: ExecutionPolicyContext & { task: Task }) {
  const registry = new ConnectorRegistry();
  const connector = spyConnector();
  registry.register(connector);
  const runner = new ExecutionRunner(registry);
  const result = await runner.run({
    account: context.account,
    campaign: context.campaign,
    task: context.task,
    content: context.content,
    approval: context.approval,
    actionsToday: context.actionsToday,
    dailyLimit: context.dailyLimit,
    consecutiveFailures: context.consecutiveFailures,
    circuitBreakerThreshold: context.circuitBreakerThreshold,
    connectorRegistry: registry,
    userConfirmed: true,
  });
  return { result, executeCalls: connector.executeCalls };
}

describe("commercial proof harness policy gate (fail closed)", () => {
  it("allows the proof action when every gate passes on its merits", () => {
    const decision = evaluateExecutionPolicy(proofContext());
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("allowed");
  });

  it("blocks a campaign that is not running and never calls connector.execute", async () => {
    const halted: Campaign = {
      ...(proofContext().campaign as Campaign),
      status: "paused",
    };
    const context = proofContext({ campaign: halted });
    const decision = evaluateExecutionPolicy(context);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("campaign_not_runnable");

    const { result, executeCalls } = await runWithSpy(context);
    expect(result.status).toBe("blocked");
    expect(executeCalls).toBe(0);
  });

  it("blocks at the daily limit and never calls connector.execute", async () => {
    const context = proofContext({
      actionsToday: DEFAULT_EXECUTION_DAILY_LIMIT,
    });
    const decision = evaluateExecutionPolicy(context);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("daily_limit_reached");

    const { executeCalls } = await runWithSpy(context);
    expect(executeCalls).toBe(0);
  });

  it("blocks with the circuit breaker open and never calls connector.execute", async () => {
    const context = proofContext({
      consecutiveFailures: DEFAULT_EXECUTION_CIRCUIT_BREAKER_THRESHOLD,
    });
    const decision = evaluateExecutionPolicy(context);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("circuit_breaker_open");

    const { executeCalls } = await runWithSpy(context);
    expect(executeCalls).toBe(0);
  });
});
