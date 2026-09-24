import { performance } from "node:perf_hooks";
import { TaskQueue } from "../packages/core/src/queue/taskQueue.ts";

const COUNT = 5_000;
const BUDGET_MS = 5_000;

const queue = new TaskQueue({
  retryPolicy: { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 1_000 },
});

const started = performance.now();

for (let index = 0; index < COUNT; index += 1) {
  queue.enqueue({
    id: "perf-task-" + index,
    workspaceId: "workspace-perf",
    campaignId: "campaign-perf",
    accountId: "account-perf",
    platform: "facebook",
    kind: "publish",
    priority: index % 10,
    status: "pending",
    attempts: 0,
    maxAttempts: 3,
    availableAt: "2026-09-24T00:00:00.000Z",
    idempotencyKey: "perf-" + index,
    createdAt: "2026-09-24T00:00:00.000Z",
  });
}

const stats = queue.stats();
const snapshot = queue.snapshot();
const elapsed = performance.now() - started;

if (stats.pending !== COUNT) {
  throw new Error("Performance smoke queue count mismatch: " + stats.pending);
}
if (snapshot.length !== COUNT) {
  throw new Error("Performance smoke snapshot count mismatch: " + snapshot.length);
}
if (elapsed > BUDGET_MS) {
  throw new Error(`Performance smoke exceeded ${BUDGET_MS}ms budget: ${elapsed.toFixed(1)}ms`);
}

console.log(JSON.stringify({
  test: "queue-enqueue-snapshot",
  operations: COUNT,
  elapsedMs: Number(elapsed.toFixed(1)),
  budgetMs: BUDGET_MS,
}));
