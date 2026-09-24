import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { openDb } from "../../src/data/sqlite.ts";
import {
  createFileQueueStore,
  PersistentQueue,
} from "../../src/queue/persistence.ts";
import { UnifiedInbox } from "../../src/inbox/index.ts";
import { MediaIndex } from "../../src/media/index.ts";
import { generatePlatformVariants } from "../../src/content/variants.ts";

const dir = process.argv[2];
if (!dir) {
  console.error("usage: perf-memory-worker <dir>");
  process.exit(2);
}

const now = "2026-09-24T00:00:00.000Z";
const CONTACTS = 1000;
const TASKS = 500;
const MESSAGES = 500;
const MEDIA = 200;
const VARIANTS = 50;

const db = openDb(join(dir, "orbit.db"));
db.transaction(() => {
  for (let i = 0; i < CONTACTS; i++) {
    db.insertContact({
      id: `c${String(i).padStart(4, "0")}`,
      workspaceId: "ws1",
      name: `Contact ${i}`,
      email: `user${i}@example.com`,
      tags: i % 2 === 0 ? ["lead", "vip"] : ["lead"],
      createdAt: now,
      updatedAt: now,
    });
  }
});

const queue = await PersistentQueue.open(
  createFileQueueStore(join(dir, "queue.json")),
  now,
);
for (let i = 0; i < TASKS; i++) {
  await queue.enqueue(
    {
      id: `t${i}`,
      workspaceId: "ws1",
      platform: "facebook",
      accountId: `acc-${i % 10}`,
      actionType: "post_page",
      target: `page-${i % 25}`,
      payload: { text: `task payload ${i}` },
      status: "queued",
      priority: "normal",
      retries: 0,
      maxRetries: 3,
      scheduledTime: now,
    },
    now,
  );
}

const inbox = new UnifiedInbox();
for (let i = 0; i < MESSAGES; i++) {
  inbox.ingest({
    workspaceId: "ws1",
    platform: "facebook",
    accountId: `acc-${i % 10}`,
    externalThreadId: `thread-${i % 50}`,
    externalMessageId: `msg-${i}`,
    sender: `sender-${i % 30}`,
    text: `Message body number ${i} with some marketing context`,
    timestamp: new Date(Date.parse(now) + i * 1000).toISOString(),
  });
}

const media = new MediaIndex();
for (let i = 0; i < MEDIA; i++) {
  media.add({
    id: `media-${i}`,
    workspaceId: "ws1",
    filename: `asset-${i}.${i % 3 === 0 ? "png" : "jpg"}`,
    mimeType: i % 3 === 0 ? "image/png" : "image/jpeg",
    sizeBytes: 1024 + i,
    tags: i % 2 === 0 ? ["promo"] : ["organic"],
    createdAt: now,
  });
}
media.search({ workspaceId: "ws1", mimeType: "image/" });

const provider = {
  id: "perf-fixture",
  async generateVariant(request) {
    return `(${request.platform}) ${request.title}: ${request.body}`.slice(
      0,
      280,
    );
  },
};
for (let i = 0; i < VARIANTS; i++) {
  await generatePlatformVariants(
    { id: `content-${i}`, workspaceId: "ws1", title: `Title ${i}`, body: `Body ${i}` },
    ["twitter", "instagram"],
    provider,
  );
}

const memory = process.memoryUsage();
const result = {
  rss: memory.rss,
  heapUsed: memory.heapUsed,
  contacts: CONTACTS,
  tasks: queue.list().length,
  messages: inbox.listConversations("ws1").reduce((n, c) => n + c.unreadCount, 0),
  media: media.count("ws1"),
  variants: VARIANTS * 2,
};
writeFileSync(join(dir, "result.json"), JSON.stringify(result), "utf8");
console.log(JSON.stringify(result));
