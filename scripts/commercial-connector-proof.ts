#!/usr/bin/env node
import { TelegramConnector } from "../packages/core/src/connectors/telegram.js";
import { LinkedInConnector } from "../packages/core/src/connectors/linkedin.js";

const args = new Set(process.argv.slice(2));
const confirmed = args.has("--confirm-live");
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

const testContent = async () => ({
  telegram: "ORBIT connector proof test — do not treat as customer-facing content.",
  linkedin: "ORBIT connector proof test — do not treat as customer-facing content.",
});

let telegramDelivered = false;
let linkedinDelivered = false;

const telegram = new TelegramConnector({
  tokenResolver: async () => telegramToken,
  contentResolver: async () => (await testContent()).telegram,
});

const telegramConnection = await telegram.connect({
  accountId: "commercial-proof-telegram",
  userConfirmed: true,
});
if (telegramConnection.status !== "succeeded") {
  throw new Error(
    "Telegram authorization proof failed: " +
      (telegramConnection.message ?? telegramConnection.reason ?? "unknown"),
  );
}

const telegramOutcome = await telegram.execute(
  {
    id: "commercial-proof-telegram-task",
    workspaceId: "commercial-proof",
    campaignId: "commercial-proof",
    accountId: "commercial-proof-telegram",
    platform: "telegram",
    kind: "publish",
    contentId: "commercial-proof-telegram-content",
    destinationId: telegramChatId,
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
if (telegramOutcome.status !== "succeeded") {
  throw new Error(
    "Telegram delivery proof failed: " +
      (telegramOutcome.message ?? telegramOutcome.reason ?? "unknown"),
  );
}
telegramDelivered = Boolean(telegramOutcome.externalId);

const linkedin = new LinkedInConnector({
  apiVersion: process.env.ORBIT_LINKEDIN_API_VERSION ?? "202609",
  tokenResolver: async () => linkedinToken,
  authorResolver: async () => linkedinAuthor,
  contentResolver: async () => (await testContent()).linkedin,
});

const linkedinOutcome = await linkedin.execute(
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
if (linkedinOutcome.status !== "succeeded") {
  throw new Error(
    "LinkedIn delivery proof failed: " +
      (linkedinOutcome.message ?? linkedinOutcome.reason ?? "unknown"),
  );
}
linkedinDelivered = Boolean(linkedinOutcome.externalId);

console.log(
  JSON.stringify({
    commercialConnectorProof: "PASS",
    telegram: {
      authorized: telegramConnection.status === "succeeded",
      delivered: telegramDelivered,
    },
    linkedin: {
      authorized: true,
      delivered: linkedinDelivered,
    },
    note: "No tokens, message bodies, or credential material are printed.",
  }),
);
