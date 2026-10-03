#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { TelegramConnector } from "../packages/core/src/connectors/telegram.js";
import { LinkedInConnector } from "../packages/core/src/connectors/linkedin.js";
import {
  DEFAULT_EXECUTION_CIRCUIT_BREAKER_THRESHOLD,
  DEFAULT_EXECUTION_DAILY_LIMIT,
  evaluateExecutionPolicy,
} from "../packages/core/src/workflows/executionPolicy.js";
import type {
  Approval,
  Campaign,
  ContentItem,
  Platform,
  SocialAccount,
  Task,
} from "../packages/core/src/types/index.js";

const argv = process.argv.slice(2);
const args = new Set(argv);
const confirmed = args.has("--confirm-live");
const outputIndex = argv.indexOf("--output");
let output = ".artifacts/commercial-connector-proof.json";

if (outputIndex >= 0) {
  const candidate = argv[outputIndex + 1];
  if (!candidate || candidate.startsWith("--")) {
    console.error("commercial-connector-proof=BLOCKED");
    console.error("--output requires a non-flag filename.");
    process.exit(2);
  }
  output = candidate;
}

if (!confirmed) {
  console.error("commercial-connector-proof=BLOCKED");
  console.error("Live connector proof requires --confirm-live.");
  process.exit(2);
}

const telegramToken = process.env.ORBIT_TELEGRAM_TEST_TOKEN;
const telegramChatId = process.env.ORBIT_TELEGRAM_TEST_CHAT_ID;
const linkedinToken = process.env.ORBIT_LINKEDIN_TEST_TOKEN;
const linkedinAuthor = process.env.ORBIT_LINKEDIN_TEST_AUTHOR_URN;
const releaseSha = process.env.GITHUB_SHA ?? "unknown";

const missing = [];
if (!telegramToken) missing.push("ORBIT_TELEGRAM_TEST_TOKEN");
if (!telegramChatId) missing.push("ORBIT_TELEGRAM_TEST_CHAT_ID");
if (!linkedinToken) missing.push("ORBIT_LINKEDIN_TEST_TOKEN");
if (!linkedinAuthor) missing.push("ORBIT_LINKEDIN_TEST_AUTHOR_URN");

if (missing.length > 0) {
  console.error("commercial-connector-proof=BLOCKED");
  console.error("Missing local test inputs: " + missing.join(", "));
  process.exit(2);
}

const testContent = {
  telegram:
    "ORBIT connector proof test — do not treat as customer-facing content.",
  linkedin:
    "ORBIT connector proof test — do not treat as customer-facing content.",
} as const;

// The proof harness runs with real platform tokens, so it must fail closed on
// the same execution policy as the queue layer rather than bypassing it. The
// --confirm-live flag is the operator's explicit confirmation and is
// represented as an approved Approval tied to the proof content; the daily
// budget and circuit breaker use the production defaults with counters at
// zero (this process is a single deliberate proof action).
const PROOF_WORKSPACE_ID = "commercial-proof";
const PROOF_CAMPAIGN_ID = "commercial-proof";

type ProofPolicyInputs = {
  account: SocialAccount;
  campaign: Campaign;
  content: ContentItem;
  approval: Approval;
};

function buildProofPolicyInputs(
  platform: Platform,
  accountId: string,
  task: Task & { contentId: string },
  body: string,
): ProofPolicyInputs {
  const now = new Date().toISOString();
  const account: SocialAccount = {
    id: accountId,
    workspaceId: PROOF_WORKSPACE_ID,
    platform,
    displayName: "commercial-proof " + platform,
    status: "connected",
    healthScore: 100,
    createdAt: now,
  };
  const campaign: Campaign = {
    id: PROOF_CAMPAIGN_ID,
    workspaceId: PROOF_WORKSPACE_ID,
    name: "commercial-proof",
    status: "running",
    accountIds: [accountId],
    contentIds: [task.contentId],
    taskCount: 1,
    createdAt: now,
  };
  const content: ContentItem = {
    id: task.contentId,
    workspaceId: PROOF_WORKSPACE_ID,
    title: "commercial-proof",
    body,
    platformVariants: {
      facebook: undefined,
      instagram: undefined,
      telegram: platform === "telegram" ? body : undefined,
      whatsapp: undefined,
      linkedin: platform === "linkedin" ? body : undefined,
      tiktok: undefined,
    },
    approvalStatus: "approved",
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
  // The --confirm-live flag is the operator's explicit approved approval for
  // this exact proof content; without it the script already exits (2) above.
  const approval: Approval = {
    id: "commercial-proof-approval-" + platform,
    workspaceId: PROOF_WORKSPACE_ID,
    contentId: task.contentId,
    requestedBy: "commercial-proof-operator",
    reviewerIds: ["commercial-proof-operator"],
    status: "approved",
    decidedBy: "commercial-proof-operator",
    decidedAt: now,
    note: "--confirm-live operator confirmation",
  };
  return { account, campaign, content, approval };
}

function policyBeforeExecute(
  inputs: ProofPolicyInputs,
  task: Task,
): string | null {
  const decision = evaluateExecutionPolicy({
    account: inputs.account,
    campaign: inputs.campaign,
    task,
    content: inputs.content,
    approval: inputs.approval,
    actionsToday: 0,
    dailyLimit: DEFAULT_EXECUTION_DAILY_LIMIT,
    consecutiveFailures: 0,
    circuitBreakerThreshold: DEFAULT_EXECUTION_CIRCUIT_BREAKER_THRESHOLD,
  });
  if (decision.allowed) return null;
  return decision.message + " (policy: " + decision.reason + ")";
}

type PlatformProof = {
  authorized: boolean;
  delivered: boolean;
  externalId: string | number | null;
  status: "succeeded" | "failed";
  message?: string;
};

async function writeReport(
  telegram: PlatformProof,
  linkedin: PlatformProof,
  reportStatus: "PASS" | "FAIL",
): Promise<void> {
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    releaseSha,
    commercialConnectorProof: reportStatus,
    telegram,
    linkedin,
    note: "No tokens, message bodies, or credential material are persisted or printed.",
  };

  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + "\n", "utf8");

  console.log(
    JSON.stringify({
      output,
      releaseSha,
      commercialConnectorProof: reportStatus,
      telegram: {
        authorized: telegram.authorized,
        delivered: telegram.delivered,
        externalId: telegram.externalId,
        status: telegram.status,
      },
      linkedin: {
        authorized: linkedin.authorized,
        delivered: linkedin.delivered,
        externalId: linkedin.externalId,
        status: linkedin.status,
      },
    }),
  );
}

const telegram: PlatformProof = {
  authorized: false,
  delivered: false,
  externalId: null,
  status: "failed",
};

const linkedin: PlatformProof = {
  authorized: false,
  delivered: false,
  externalId: null,
  status: "failed",
};

try {
  const telegramConnector = new TelegramConnector({
    tokenResolver: async () => telegramToken,
    contentResolver: async () => testContent.telegram,
  });

  try {
    const connection = await telegramConnector.connect({
      accountId: "commercial-proof-telegram",
      userConfirmed: true,
    });

    telegram.authorized = connection.status === "succeeded";

    if (telegram.authorized) {
      const telegramTask = {
        id: "commercial-proof-telegram-task",
        workspaceId: PROOF_WORKSPACE_ID,
        campaignId: PROOF_CAMPAIGN_ID,
        accountId: "commercial-proof-telegram",
        platform: "telegram",
        kind: "publish",
        contentId: "commercial-proof-telegram-content",
        destinationId: telegramChatId!,
        priority: 1,
        status: "pending",
        attempts: 0,
        maxAttempts: 1,
        availableAt: new Date().toISOString(),
        idempotencyKey: "commercial-proof-telegram",
        createdAt: new Date().toISOString(),
      } as const;
      // Fail closed on the production execution policy before any real-token
      // connector call, exactly as the queue layer does.
      const blockedBy = policyBeforeExecute(
        buildProofPolicyInputs(
          "telegram",
          "commercial-proof-telegram",
          telegramTask,
          testContent.telegram,
        ),
        telegramTask,
      );
      if (blockedBy) {
        telegram.message = blockedBy;
      } else {
        const outcome = await telegramConnector.execute(telegramTask, {
          accountId: "commercial-proof-telegram",
          userConfirmed: true,
        });

        telegram.status =
          outcome.status === "succeeded" && Boolean(outcome.externalId)
            ? "succeeded"
            : "failed";
        telegram.delivered = telegram.status === "succeeded";
        telegram.externalId = outcome.externalId ?? null;
        telegram.message = outcome.message ?? outcome.reason;
      }
    } else {
      telegram.message =
        connection.message ?? connection.reason ?? "authorization failed";
    }
  } catch (error) {
    telegram.message = error instanceof Error ? error.message : String(error);
  }

  try {
    const linkedinConnector = new LinkedInConnector({
      apiVersion: process.env.ORBIT_LINKEDIN_API_VERSION ?? "202609",
      tokenResolver: async () => linkedinToken,
      authorResolver: async () => linkedinAuthor,
      contentResolver: async () => testContent.linkedin,
    });

    const connection = await linkedinConnector.connect({
      accountId: "commercial-proof-linkedin",
      userConfirmed: true,
    });

    linkedin.authorized = connection.status === "succeeded";

    if (linkedin.authorized) {
      const linkedinTask = {
        id: "commercial-proof-linkedin-task",
        workspaceId: PROOF_WORKSPACE_ID,
        campaignId: PROOF_CAMPAIGN_ID,
        accountId: "commercial-proof-linkedin",
        platform: "linkedin",
        kind: "publish",
        contentId: "commercial-proof-linkedin-content",
        destinationId: "member",
        priority: 1,
        status: "pending",
        attempts: 0,
        maxAttempts: 1,
        availableAt: new Date().toISOString(),
        idempotencyKey: "commercial-proof-linkedin",
        createdAt: new Date().toISOString(),
      } as const;
      // Fail closed on the production execution policy before any real-token
      // connector call, exactly as the queue layer does.
      const blockedBy = policyBeforeExecute(
        buildProofPolicyInputs(
          "linkedin",
          "commercial-proof-linkedin",
          linkedinTask,
          testContent.linkedin,
        ),
        linkedinTask,
      );
      if (blockedBy) {
        linkedin.message = blockedBy;
      } else {
        const outcome = await linkedinConnector.execute(linkedinTask, {
          accountId: "commercial-proof-linkedin",
          userConfirmed: true,
          signal: AbortSignal.timeout(30_000),
        });

        linkedin.status =
          outcome.status === "succeeded" && Boolean(outcome.externalId)
            ? "succeeded"
            : "failed";
        linkedin.delivered = linkedin.status === "succeeded";
        linkedin.externalId = outcome.externalId ?? null;
        linkedin.message = outcome.message ?? outcome.reason;
      }
    } else {
      linkedin.message =
        connection.message ?? connection.reason ?? "authorization failed";
    }
  } catch (error) {
    linkedin.message = error instanceof Error ? error.message : String(error);
  }
} finally {
  const passed =
    telegram.authorized &&
    telegram.delivered &&
    telegram.externalId !== null &&
    linkedin.authorized &&
    linkedin.delivered &&
    linkedin.externalId !== null;

  await writeReport(telegram, linkedin, passed ? "PASS" : "FAIL");

  if (!passed) {
    console.error("commercial-connector-proof=FAIL");
    process.exitCode = 1;
  }
}
