import { promises as fs } from "node:fs";
import path from "node:path";
import type { QueueTask } from "../types/index.js";

export interface QueueSnapshot {
  readonly version: 1;
  readonly savedAt: string;
  readonly tasks: readonly QueueTask[];
}

export interface QueueStore {
  load(): Promise<readonly QueueTask[]>;
  save(tasks: readonly QueueTask[], savedAt: string): Promise<void>;
}

export function createMemoryQueueStore(initial: readonly QueueTask[] = []): QueueStore {
  let snapshot: QueueTask[] = [...initial];
  return {
    async load() {
      return [...snapshot];
    },
    async save(tasks, _savedAt) {
      snapshot = [...tasks];
    },
  };
}

function isQueueTask(value: unknown): value is QueueTask {
  if (!value || typeof value !== "object") return false;
  const t = value as Partial<QueueTask>;
  return (
    typeof t.id === "string" &&
    typeof t.workspaceId === "string" &&
    typeof t.status === "string" &&
    typeof t.retries === "number" &&
    typeof t.maxRetries === "number"
  );
}

export function parseQueueSnapshot(raw: string): QueueSnapshot {
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("invalid queue snapshot");
  }
  const snap = parsed as Partial<QueueSnapshot>;
  if (snap.version !== 1 || !Array.isArray(snap.tasks)) {
    throw new Error("unsupported queue snapshot format");
  }
  if (!snap.tasks.every(isQueueTask)) {
    throw new Error("corrupt queue snapshot task entry");
  }
  if (typeof snap.savedAt !== "string") {
    throw new Error("missing savedAt");
  }
  return { version: 1, savedAt: snap.savedAt, tasks: snap.tasks as QueueTask[] };
}

export function serializeQueueSnapshot(snapshot: QueueSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}

export function createFileQueueStore(filePath: string): QueueStore {
  const dir = path.dirname(filePath);
  return {
    async load() {
      try {
        const raw = await fs.readFile(filePath, "utf8");
        return parseQueueSnapshot(raw).tasks;
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === "ENOENT") return [];
        throw err;
      }
    },
    async save(tasks, savedAt) {
      await fs.mkdir(dir, { recursive: true });
      const tmp = `${filePath}.tmp`;
      const body = serializeQueueSnapshot({ version: 1, savedAt, tasks });
      await fs.writeFile(tmp, body, "utf8");
      await fs.rename(tmp, filePath);
    },
  };
}

const ACTIVE_STATUSES = new Set(["queued", "retrying", "running"]);

export function recoverQueueState(tasks: readonly QueueTask[], now: string): QueueTask[] {
  return tasks.map((task) => {
    if (task.status === "running") {
      return {
        ...task,
        status: task.retries < task.maxRetries ? "retrying" : "failed",
        lastError: task.lastError ?? "interrupted_before_restart",
        executedTime: now,
      };
    }
    return task;
  });
}

export class PersistentQueue {
  private tasks: QueueTask[] = [];

  private constructor(private readonly store: QueueStore) {}

  static async open(store: QueueStore, now: string): Promise<PersistentQueue> {
    const queue = new PersistentQueue(store);
    const loaded = await store.load();
    queue.tasks = recoverQueueState(loaded, now);
    if (queue.tasks.length !== loaded.length || loaded.some((t) => t.status === "running")) {
      await queue.persist(now);
    }
    return queue;
  }

  list(): readonly QueueTask[] {
    return this.tasks;
  }

  active(): readonly QueueTask[] {
    return this.tasks.filter((t) => ACTIVE_STATUSES.has(t.status));
  }

  get(id: string): QueueTask | undefined {
    return this.tasks.find((t) => t.id === id);
  }

  async enqueue(task: QueueTask, now: string): Promise<QueueTask> {
    if (this.tasks.some((t) => t.id === task.id)) {
      throw new Error(`duplicate task id: ${task.id}`);
    }
    this.tasks = [...this.tasks, task];
    await this.persist(now);
    return task;
  }

  async replace(task: QueueTask, now: string): Promise<QueueTask> {
    const idx = this.tasks.findIndex((t) => t.id === task.id);
    if (idx < 0) throw new Error(`unknown task id: ${task.id}`);
    this.tasks = this.tasks.map((t, i) => (i === idx ? task : t));
    await this.persist(now);
    return task;
  }

  async persist(now: string): Promise<void> {
    await this.store.save(this.tasks, now);
  }
}
