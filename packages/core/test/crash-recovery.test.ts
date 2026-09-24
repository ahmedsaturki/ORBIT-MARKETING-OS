import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type OrbitDb } from "../src/data/sqlite.js";
import {
  createFileQueueStore,
  PersistentQueue,
} from "../src/queue/persistence.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKER = join(HERE, "fixtures", "crash-worker.mjs");

function waitForFile(path: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      if (existsSync(path)) {
        resolve();
        return;
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`timed out waiting for ${path}`));
        return;
      }
      setTimeout(tick, 50);
    };
    tick();
  });
}

function isGone(child: ChildProcess): boolean {
  return child.exitCode !== null || child.signalCode !== null;
}

function forceKill(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (isGone(child)) {
      resolve();
      return;
    }
    child.once("exit", () => resolve());
    child.kill("SIGKILL");
  });
}

describe("crash recovery (OPS-01)", () => {
  let dir: string;
  let child: ChildProcess | undefined;
  let db: OrbitDb | undefined;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "orbit-crash-"));
    child = undefined;
    db = undefined;
  });

  afterEach(async () => {
    if (child && !isGone(child)) {
      await forceKill(child);
    }
    child = undefined;
    db?.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it(
    "recovers queue and database after forced termination mid-transaction",
    async () => {
      let stderr = "";
      child = spawn(
        process.execPath,
        ["--experimental-transform-types", WORKER, dir],
        { stdio: ["ignore", "ignore", "pipe"] },
      );
      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      const exitedEarly = new Promise<never>((_, reject) => {
        child!.once("exit", (code) =>
          reject(new Error(`worker exited before ready (code ${code}): ${stderr}`)),
        );
      });

      await Promise.race([
        waitForFile(join(dir, "ready"), 30000),
        exitedEarly,
      ]);
      // Force-kill while the worker holds an open (uncommitted) transaction.
      await forceKill(child);

      // Queue: durable snapshot survives; interrupted "running" task recovers.
      const queue = await PersistentQueue.open(
        createFileQueueStore(join(dir, "queue.json")),
        "2026-09-24T00:05:00.000Z",
      );
      expect(queue.list()).toHaveLength(3);
      expect(queue.get("t1")?.status).toBe("queued");
      expect(queue.get("t2")?.status).toBe("retrying");
      expect(queue.get("t2")?.retries).toBe(1);
      expect(queue.get("t2")?.lastError).toBe("interrupted_before_restart");
      expect(queue.get("t3")?.status).toBe("completed");

      // Database: committed batch survives, uncommitted transaction rolls back.
      db = openDb(join(dir, "orbit.db"));
      expect(db.schemaVersion).toBe(2);
      expect(db.countContacts("ws1")).toBe(50);
      expect(db.getContact("ws1", "c000")?.name).toBe("Contact 0");
      expect(db.getContact("ws1", "uncommitted")).toBeUndefined();
      expect(db.searchContacts("ws1", "Contact 42")).toHaveLength(1);

      const integrity = db.db
        .prepare("PRAGMA integrity_check")
        .get() as Record<string, unknown>;
      expect(String(Object.values(integrity)[0])).toBe("ok");

      // Recovery itself is durable: reopening again keeps the same state.
      db.close();
      db = openDb(join(dir, "orbit.db"));
      expect(db.countContacts("ws1")).toBe(50);
      const queueAgain = await PersistentQueue.open(
        createFileQueueStore(join(dir, "queue.json")),
        "2026-09-24T00:10:00.000Z",
      );
      expect(queueAgain.list()).toHaveLength(3);
      expect(queueAgain.get("t2")?.status).toBe("retrying");
    },
    45000,
  );
});
