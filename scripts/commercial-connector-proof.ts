#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { TelegramConnector } from "../packages/core/src/connectors/telegram.js";
import { LinkedInConnector } from "../packages/core/src/connectors/linkedin.js";

const argv = process.argv.slice(2);
const args = new Set(argv);
const confirmed = args.has("--confirm-live");
const outputIndex = argv.indexOf("--output");
const output =
  outputIndex >= 0
    ? (argv[outputIndex + 1] ?? ".artifacts/commercial-connector-proof.json")
    : ".artifacts/commercial-connector-proof.json";

if (!confirmed) {
  console.error("commercial-connector-proof=BLOCKED");
  console.error("Live connector proof requires --confirm-live.");
  process.exit(2);
}

const telegramToken = process.env.ORBIT_TELEGRAM_TEST_TOKEN;
const telegramChatId = process.env.ORBIT_TELEGRAM_TEST_CHAT_ID;
const linkedinToken = process.env.ORBIT_LINKEDIN_TEST_TOKEN;
const linkedinAuthor = process.env.ORBIT_LINKEDIN_TEST_AUTHOR_URN;

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
      const outcome = await telegramConnector.execute(
        {
          id: "commercial-proof-telegram-task",
          workspaceId: "commercial-proof",
          campaignId: "commercial-proof",
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
        },
        { accountId: "commercial-proof-telegram", userConfirmed: true },
      );

      telegram.status =
        outcome.status === "succeeded" && Boolean(outcome.externalId)
          ? "succeeded"
          : "failed";
      telegram.delivered = telegram.status === "succeeded";
      telegram.externalId = outcome.externalId ?? null;
      telegram.message = outcome.message ?? outcome.reason;
    } else {
      telegram.message =
        connection.message ?? connection.reason ?? "authorization failed";
    }
  } catch (error) {
    telegram.message =
      error instanceof Error ? error.message : String(error);
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
      const outcome = await linkedinConnector.execute(
        {
          id: "commercial-proof-linkedin-task",
          workspaceId: "commercial-proof",
          campaignId: "commercial-proof",
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
        },
        { accountId: "commercial-proof-linkedin", userConfirmed: true },
      );

      linkedin.status =
        outcome.status === "succeeded" && Boolean(outcome.externalId)
          ? "succeeded"
          : "failed";
      linkedin.delivered = linkedin.status === "succeeded";
      linkedin.externalId = outcome.externalId ?? null;
      linkedin.message = outcome.message ?? outcome.reason;
    } else {
      linkedin.message =
        connection.message ?? connection.reason ?? "authorization failed";
    }
  } catch (error) {
    linkedin.message =
      error instanceof Error ? error.message : String(error);
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
