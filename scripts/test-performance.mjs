import { performance } from "node:perf_hooks";

const { TaskQueue } = await import("../packages/core/dist/queue/taskQueue.js");

const taskCount = Number.parseInt(process.env.ORBIT_PERF_TASKS ?? "10000", 10);
if (!Number.isInteger(taskCount) || taskCount < 1000 || taskCount > 50000) {
  throw new Error("ORBIT_PERF_TASKS must be between 1000 and 50000");
}

function task(index) {
  return {
    id: "perf-task-" + index,
    workspaceId: "perf-workspace",
    campaignId: "perf-campaign",
    accountId: "perf-account",
    platform: "telegram",
    kind: "publish",
    contentId: "perf-content-" + index,
    destinationId: "perf-destination-" + index,
    priority: index % 10,
    status: "pending",
    attempts: 0,
    maxAttempts: 3,
    availableAt: "2026-09-24T00:00:00.000Z",
    idempotencyKey: "perf-key-" + index,
    createdAt: "2026-09-24T00:00:00.000Z",
  };
}

const rssBefore = process.memoryUsage().rss;
const queue = new TaskQueue({
  retryPolicy: {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 60000,
  },
});

const start = performance.now();
for (let i = 0; i < taskCount; i += 1) queue.enqueue(task(i));
const enqueueMs = performance.now() - start;

const claimStart = performance.now();
for (let i = 0; i < taskCount; i += 1) {
  const claimed = queue.claimNext("2026-09-24T00:00:01.000Z");
  if (!claimed) throw new Error("queue claim stopped at " + i);
}
const claimMs = performance.now() - claimStart;

const snapshotStart = performance.now();
const snapshot = queue.snapshot();
const snapshotMs = performance.now() - snapshotStart;

const rssAfter = process.memoryUsage().rss;
const rssDeltaMiB = (rssAfter - rssBefore) / (1024 * 1024);

const limits = {
  enqueueMs: 5000,
  claimMs: 5000,
  snapshotMs: 1000,
  rssDeltaMiB: 256,
};

const metrics = {
  taskCount,
  enqueueMs: Number(enqueueMs.toFixed(2)),
  claimMs: Number(claimMs.toFixed(2)),
  snapshotMs: Number(snapshotMs.toFixed(2)),
  rssDeltaMiB: Number(rssDeltaMiB.toFixed(2)),
  snapshotCount: snapshot.length,
};

for (const [metric, limit] of Object.entries(limits)) {
  if (metrics[metric] > limit) {
    throw new Error(metric + " exceeded smoke budget: " + metrics[metric] + " > " + limit);
  }
}

if (snapshot.length !== taskCount) throw new Error("queue snapshot count mismatch");

console.log("ORBIT performance smoke passed", JSON.stringify(metrics));
