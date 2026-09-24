import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PersistentQueue,
  createFileQueueStore,
  createMemoryQueueStore,
  parseQueueSnapshot,
  recoverQueueState,
} from "../src/queue/persistence.js";
import type { QueueTask } from "../src/types/index.js";

const task: QueueTask = {
  id: "p-1",
  workspaceId: "ws-1",
  platform: "facebook",
  accountId: "acc-1",
  actionType: "post_group",
  target: "group-1",
  payload: { text: "hi" },
  status: "queued",
  priority: "normal",
  retries: 0,
  maxRetries: 3,
  scheduledTime: "2026-09-24T10:00:00.000Z",
};

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "orbit-queue-"));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe("queue persistence (restart recovery)", () => {
  it("restores queued tasks after process restart via file store", async () => {
    const file = path.join(dir, "queue.json");
    const store = createFileQueueStore(file);

    const first = await PersistentQueue.open(store, "2026-09-24T10:00:00.000Z");
    await first.enqueue(task, "2026-09-24T10:00:01.000Z");

    const second = await PersistentQueue.open(createFileQueueStore(file), "2026-09-24T11:00:00.000Z");
    expect(second.list()).toHaveLength(1);
    expect(second.get("p-1")?.status).toBe("queued");
    expect(second.get("p-1")?.payload).toEqual({ text: "hi" });
  });

  it("requeues interrupted running tasks and fails exhausted ones", async () => {
    const running: QueueTask = { ...task, id: "run-1", status: "running", retries: 1 };
    const exhausted: QueueTask = { ...task, id: "run-2", status: "running", retries: 3, maxRetries: 3 };
    const recovered = recoverQueueState([running, exhausted], "2026-09-24T12:00:00.000Z");
    expect(recovered[0]?.status).toBe("retrying");
    expect(recovered[0]?.retries).toBe(1);
    expect(recovered[1]?.status).toBe("failed");
    expect(recovered[1]?.lastError).toBe("interrupted_before_restart");
  });

  it("rejects corrupt snapshots instead of silently dropping tasks", async () => {
    const file = path.join(dir, "bad.json");
    await fs.writeFile(file, JSON.stringify({ version: 2, tasks: [] }), "utf8");
    await expect(createFileQueueStore(file).load()).rejects.toThrow(/unsupported|corrupt|invalid/);
  });

  it("writes atomically so a crash mid-save keeps previous state readable", async () => {
    const file = path.join(dir, "atomic.json");
    const store = createFileQueueStore(file);
    await store.save([task], "2026-09-24T10:00:00.000Z");

    const broken = path.join(dir, "broken.json");
    await fs.writeFile(broken, "{ not json", "utf8");
    await expect(createFileQueueStore(broken).load()).rejects.toThrow();

    const loaded = await store.load();
    expect(loaded).toHaveLength(1);
    expect(await fs.readdir(dir)).not.toContain("atomic.json.tmp");
  });

  it("treats missing file as empty queue", async () => {
    const store = createFileQueueStore(path.join(dir, "missing.json"));
    expect(await store.load()).toEqual([]);
  });

  it("parse rejects non-object and missing fields", () => {
    expect(() => parseQueueSnapshot("null")).toThrow();
    expect(() => parseQueueSnapshot('{"version":1,"savedAt":"x","tasks":[{"id":1}]}')).toThrow(/corrupt/);
    expect(() => parseQueueSnapshot('{"version":1,"tasks":[]}')).toThrow(/savedAt/);
  });

  it("memory store round-trips tasks", async () => {
    const store = createMemoryQueueStore();
    await store.save([task], "2026-09-24T10:00:00.000Z");
    expect(await store.load()).toHaveLength(1);
    const q1 = await PersistentQueue.open(store, "2026-09-24T10:00:00.000Z");
    await expect(q1.enqueue(task, "2026-09-24T10:00:01.000Z")).rejects.toThrow(/duplicate/);
    const q2 = await PersistentQueue.open(store, "2026-09-24T10:05:00.000Z");
    expect(q2.get("p-1")?.status).toBe("queued");
  });

  it("replace updates existing task and persists", async () => {
    const store = createMemoryQueueStore();
    const q = await PersistentQueue.open(store, "2026-09-24T10:00:00.000Z");
    await q.enqueue(task, "2026-09-24T10:00:01.000Z");
    await q.replace({ ...task, status: "completed", retries: 1 }, "2026-09-24T10:01:00.000Z");
    expect(q.get("p-1")?.status).toBe("completed");
    expect(q.active()).toHaveLength(0);
    await expect(q.replace({ ...task, id: "nope" }, "2026-09-24T10:02:00.000Z")).rejects.toThrow(/unknown/);
  });
});
