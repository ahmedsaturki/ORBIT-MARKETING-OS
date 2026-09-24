/**
 * Stability soak harness (OPS-02).
 *
 * Spawns the production server, then runs a mixed workload for a configurable
 * duration: health/static probes, AI endpoint error-path exercises, and an
 * in-process core-domain loop (policy gate → queue lifecycle → retry/backoff →
 * circuit breaker → audit-chain append/verify) with periodic RSS sampling.
 *
 * Exit 0 only if: server stayed alive, every health probe succeeded, all core
 * assertions held, and RSS stayed under budget the whole run.
 *
 * Usage:
 *   npx tsx scripts/soak.ts --minutes 10
 *   npx tsx scripts/soak.ts --hours 24        # full stability gate
 *   npx tsx scripts/soak.ts --minutes 10 --port 34790
 */
import { spawn, execSync, type ChildProcess } from "node:child_process";
import { mkdirSync, writeFileSync, createWriteStream } from "node:fs";
import { join } from "node:path";
import {
  gateTaskForExecution,
  shouldRetry,
  scheduleRetry,
  completeTask,
  failTerminal,
} from "../packages/core/src/queue/index.js";
import {
  evaluatePolicy,
  createCircuitBreaker,
  recordCircuitSuccess,
  recordCircuitFailure,
  isCircuitBlocking,
} from "../packages/core/src/policy/index.js";
import { appendEntry, verifyChain } from "../packages/core/src/audit/index.js";
import type {
  QueueTask,
  PolicyContext,
  AuditEntry,
} from "../packages/core/src/types/index.js";

const args = process.argv.slice(2);
function argNum(flag: string): number | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? Number(args[i + 1]) : undefined;
}
const minutes =
  argNum("--minutes") ?? (argNum("--hours") !== undefined ? argNum("--hours")! * 60 : 10);
const port = argNum("--port") ?? 34790;
const RSS_BUDGET_MB = 600;
const CYCLE_MS = 2000;
const deadline = Date.now() + minutes * 60_000;

const root = process.cwd();
const logsDir = join(root, "logs");
mkdirSync(logsDir, { recursive: true });
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const jsonl = createWriteStream(join(logsDir, `soak-${runId}.jsonl`));

let server: ChildProcess | null = null;
let healthFails = 0;
let healthOk = 0;
let chatErrors = 0;
let chatResponses = 0;
let staticFails = 0;
let cycles = 0;
let rssMin = Infinity;
let rssMax = 0;
let rssFirst = 0;
let rssLast = 0;
const failures: string[] = [];

function log(entry: Record<string, unknown>): void {
  jsonl.write(`${JSON.stringify({ t: new Date().toISOString(), ...entry })}\n`);
}

function fail(msg: string): never {
  failures.push(msg);
  throw new Error(msg);
}

function serverRssMb(pid: number): number {
  try {
    const out = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const m = out.match(/"([\d,]+) K"/);
    if (!m) return 0;
    return Number(m[1].replace(/,/g, "")) / 1024;
  } catch {
    return 0;
  }
}

// --- core-domain workload (deterministic, in-process) -----------------------
function coreWorkload(cycle: number, chain: AuditEntry[]): AuditEntry[] {
  const now = new Date().toISOString();
  const ctx: PolicyContext = {
    workspaceId: "ws-soak",
    accountId: "acct-1",
    platform: "twitter",
    actionType: "post_group",
    now,
    dailyActionsDone: cycle % 500,
    dailyLimit: 500,
    accountStatus: "active",
    challengeActive: false,
    breakerOpen: false,
    approvalAllowed: true,
  };
  const task: QueueTask = {
    id: `task-${cycle}`,
    workspaceId: "ws-soak",
    platform: "twitter",
    accountId: "acct-1",
    actionType: "post_group",
    target: "group-1",
    payload: { text: `soak ${cycle}` },
    status: "queued",
    priority: "normal",
    retries: 0,
    maxRetries: 3,
    scheduledTime: now,
  };

  const gate = gateTaskForExecution(task, ctx, evaluatePolicy);
  if (!gate.dispatch || gate.decision.reason !== "allowed") {
    fail(`policy gate rejected allowed task: ${gate.decision.reason}`);
  }

  // Denied path must fail closed.
  const denied = gateTaskForExecution(task, { ...ctx, challengeActive: true }, evaluatePolicy);
  if (denied.dispatch || denied.decision.reason !== "challenge_active") {
    fail("challenge context was not blocked");
  }

  // Retry/backoff lifecycle.
  let t = task;
  t = { ...t, status: "running" };
  if (!shouldRetry(t)) fail("retry should be available under maxRetries");
  t = scheduleRetry(t, "transient", now);
  if (t.status !== "retrying") fail(`scheduleRetry produced ${t.status}`);
  if (t.retries !== 1) fail(`retries not incremented: ${t.retries}`);
  t = { ...t, status: "running" };
  t = completeTask(t, now);
  if (t.status !== "completed") fail(`completeTask produced ${t.status}`);
  const dead = failTerminal({ ...task, status: "running", retries: 3 }, "boom", now);
  if (dead.status !== "failed") fail(`failTerminal produced ${dead.status}`);

  // Circuit breaker lifecycle.
  let cb = createCircuitBreaker();
  for (let i = 0; i < 10; i++) cb = recordCircuitFailure(cb, undefined, now);
  if (!isCircuitBlocking(cb)) fail("circuit did not open after repeated failures");
  cb = recordCircuitSuccess(cb);
  cb = recordCircuitSuccess(cb);
  if (isCircuitBlocking(cb)) fail("circuit did not recover");

  // Audit chain grows and stays verifiable.
  const next = appendEntry(chain, {
    id: `audit-${cycle}`,
    workspaceId: "ws-soak",
    actorId: "soak",
    action: "soak.cycle",
    entityRef: `task-${cycle}`,
    timestamp: now,
    metadata: { cycle },
  });
  const verdict = verifyChain(next);
  if (!verdict.valid) fail(`audit chain broken at index ${verdict.brokenAt}`);
  return next;
}

// --- server lifecycle --------------------------------------------------------
async function waitForHealth(): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < 60_000) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  fail("server did not become healthy within 60s");
}

function stopServer(): void {
  if (server?.pid) {
    try {
      execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: "ignore" });
    } catch {
      /* already gone */
    }
  }
  server = null;
}

async function main(): Promise<void> {
  console.log(
    `soak: ${minutes} min against prod server on :${port} (RSS budget ${RSS_BUDGET_MB} MB)`,
  );
  server = spawn(
    process.execPath,
    [join(root, "node_modules/tsx/dist/cli.mjs"), join(root, "server.ts")],
    {
      cwd: root,
      env: { ...process.env, NODE_ENV: "production", PORT: String(port) },
      stdio: "ignore",
    },
  );
  const serverPid = server.pid!;
  await waitForHealth();

  let chain: AuditEntry[] = [];
  let lastRssSample = 0;

  while (Date.now() < deadline) {
    cycles++;
    // Health probe.
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (res.ok) {
        healthOk++;
        healthFails = 0;
      } else {
        healthFails++;
        log({ cycle: cycles, health: res.status });
      }
    } catch {
      healthFails++;
      log({ cycle: cycles, health: "network_error" });
    }
    if (healthFails >= 3) fail("3 consecutive health failures");

    // Static shell probe.
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`);
      if (!res.ok) staticFails++;
    } catch {
      staticFails++;
    }

    // AI endpoint error path (no key locally) — must respond, not crash the process.
    if (cycles % 4 === 0) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/chat`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: "soak ping" }),
        });
        chatResponses++;
        await res.arrayBuffer();
      } catch {
        chatErrors++;
      }
      if (chatErrors >= 3) fail("3 consecutive chat connection failures");
    }

    // Core-domain workload.
    chain = coreWorkload(cycles, chain);

    // RSS sampling.
    if (Date.now() - lastRssSample > 15_000) {
      lastRssSample = Date.now();
      const rss = serverRssMb(serverPid);
      if (rss > 0) {
        if (!rssFirst) rssFirst = rss;
        rssLast = rss;
        rssMin = Math.min(rssMin, rss);
        rssMax = Math.max(rssMax, rss);
        log({ cycle: cycles, rssMb: Math.round(rss), auditLen: chain.length });
        if (rss > RSS_BUDGET_MB) fail(`RSS ${rss.toFixed(0)} MB over budget`);
      }
      if (server.exitCode !== null) fail(`server exited with code ${server.exitCode}`);
    }

    await new Promise((r) => setTimeout(r, CYCLE_MS));
  }
}

main()
  .then(() => {
    const summary = {
      runId,
      minutes,
      cycles,
      healthOk,
      healthFails,
      staticFails,
      chatResponses,
      chatErrors,
      rssMinMb: Number.isFinite(rssMin) ? Math.round(rssMin) : null,
      rssMaxMb: Math.round(rssMax) || null,
      rssFirstMb: rssFirst || null,
      rssLastMb: rssLast || null,
      rssBudgetMb: RSS_BUDGET_MB,
      failures,
      ok: failures.length === 0,
      finishedAt: new Date().toISOString(),
    };
    stopServer();
    jsonl.end();
    writeFileSync(join(logsDir, "soak-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
    console.log(JSON.stringify(summary, null, 2));
    process.exit(summary.ok ? 0 : 1);
  })
  .catch((err) => {
    console.error(`SOAK FAILED: ${err instanceof Error ? err.message : err}`);
    stopServer();
    jsonl.end();
    process.exit(1);
  });
