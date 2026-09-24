import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { openDb } from "../../src/data/sqlite.ts";
import {
  createFileQueueStore,
  PersistentQueue,
} from "../../src/queue/persistence.ts";

const dir = process.argv[2];
if (!dir) {
  console.error("usage: crash-worker <dir>");
  process.exit(2);
}

const now = "2026-09-24T00:00:00.000Z";

const baseTask = {
  workspaceId: "ws1",
  platform: "facebook",
  accountId: "acc1",
  actionType: "post_group",
  target: "group-1",
  payload: { text: "hello" },
  priority: "normal",
  maxRetries: 3,
  scheduledTime: now,
};

const store = createFileQueueStore(join(dir, "queue.json"));
const queue = await PersistentQueue.open(store, now);
await queue.enqueue({ ...baseTask, id: "t1", status: "queued", retries: 0 }, now);
await queue.enqueue({ ...baseTask, id: "t2", status: "running", retries: 1 }, now);
await queue.enqueue({ ...baseTask, id: "t3", status: "completed", retries: 0 }, now);

const db = openDb(join(dir, "orbit.db"));
db.transaction(() => {
  for (let i = 0; i < 50; i++) {
    const id = `c${String(i).padStart(3, "0")}`;
    db.insertContact({
      id,
      workspaceId: "ws1",
      name: `Contact ${i}`,
      email: `user${i}@example.com`,
      tags: ["lead"],
      createdAt: now,
      updatedAt: now,
    });
  }
});

// Start a second write transaction and never commit: the process will be
// force-killed while this transaction is open.
db.db.exec("BEGIN");
db.insertContact({
  id: "uncommitted",
  workspaceId: "ws1",
  name: "Uncommitted Row",
  tags: [],
  createdAt: now,
  updatedAt: now,
});

writeFileSync(join(dir, "ready"), "ready", "utf8");

// Idle forever; the parent test force-kills this process.
setInterval(() => {}, 1000);
