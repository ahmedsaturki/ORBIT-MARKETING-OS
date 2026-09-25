/**
 * ORBIT stability soak harness.
 *
 * Usage:
 *   pnpm exec tsx scripts/soak.ts --minutes 10
 *   pnpm exec tsx scripts/soak.ts --hours 24
 *
 * The harness exercises the current core contracts plus the production
 * local runtime. It exits non-zero on a health failure, unexpected AI
 * endpoint behavior, queue/policy/audit invariant break, process exit, or
 * RSS budget breach.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { platform } from "node:os";

import { AuditIntegrityChain } from "../packages/core/src/audit/integrity.js";
import { TaskQueue } from "../packages/core/src/queue/taskQueue.js";
import { evaluateExecutionPolicy } from "../packages/core/src/workflows/executionPolicy.js";
import type {
  Approval,
  Campaign,
  ContentItem,
  SocialAccount,
  Task,
} from "../packages/core/src/types/index.js";

const args = process.argv.slice(2);

function readNumericArg(flag: string): number | undefined {
  const index = args.indexOf(flag);
  if (index < 0) return undefined;
  const parsed = Number(args[index + 1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const requestedMinutes =
  readNumericArg("--minutes") ??
  ((readNumericArg("--hours") ?? 0) * 60);
const minutes = requestedMinutes > 0 ? requestedMinutes : 10;
const port = readNumericArg("--port") ?? 34790;
const RSS_BUDGET_MB = 600;
const CYCLE_MS = 2_000;
const deadline = Date.now() + minutes * 60_000;

const root = process.cwd();
const logsDir = join(root, "logs");
mkdirSync(logsDir, { recursive: true });
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const logPath = join(logsDir, `soak-${runId}.jsonl`);
const summaryPath = join(logsDir, "soak-summary.json");
const jsonl = createWriteStream(logPath, { flags: "w" });

let server: ChildProcess | undefined;
let healthOk = 0;
let healthFailures = 0;
let consecutiveHealthFailures = 0;
let staticOk = 0;
let staticFailures = 0;
let consecutiveStaticFailures = 0;
let chatChecks = 0;
let chatFailures = 0;
let consecutiveChatFailures = 0;
let cycles = 0;
let rssMin = Infinity;
let rssMax = 0;
let rssFirst = 0;
let rssLast = 0;
const failures: string[] = [];

function log(entry: Record<string, unknown>): void {
  jsonl.write(JSON.stringify({ timestamp: new Date().toISOString(), ...entry }) + "\n");
}

function fail(message: string): never {
  failures.push(message);
  throw new Error(message);
}

function rssMb(pid: number): number {
  if (platform() === "linux") {
    try {
      const status = readFileSync(`/proc/${pid}/status`, "utf8");
      const match = status.match(/^VmRSS:\s+(\d+)\s+kB$/m);
      return match ? Number(match[1]) / 1024 : 0;
    } catch {
      return 0;
    }
  }

  if (platform() === "darwin") {
    try {
      const value = execFileSync("ps", ["-o", "rss=", "-p", String(pid)], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      const kb = Number(value);
      return Number.isFinite(kb) ? kb / 1024 : 0;
    } catch {
      return 0;
    }
  }

  try {
    const out = execFileSync("tasklist", ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const match = out.match(/"([\d,]+) K"/);
    return match ? Number(match[1].replaceAll(",", "")) / 1024 : 0;
  } catch {
    return 0;
  }
}

function taskForCycle(cycle: number): Task {
  const timestamp = new Date().toISOString();
  return {
    id: `soak-task-${cycle}`,
    workspaceId: "soak-workspace",
    campaignId: "soak-campaign",
    accountId: "soak-account",
    platform: "telegram",
    kind: "publish",
    contentId: `soak-content-${cycle}`,
    destinationId: "soak-destination",
    priority: 1,
    status: "pending",
    attempts: 0,
    maxAttempts: 3,
    availableAt: timestamp,
    idempotencyKey: `soak-idempotency-${cycle}`,
    createdAt: timestamp,
  };
}

function runCoreInvariantWorkload(cycle: number): void {
  const timestamp = new Date().toISOString();
  const task = taskForCycle(cycle);
  const account: SocialAccount = {
    id: task.accountId,
    workspaceId: task.workspaceId,
    platform: "telegram",
    displayName: "Soak account",
    status: "connected",
    healthScore: 100,
    createdAt: timestamp,
  };
  const content: ContentItem = {
    id: task.contentId!,
    workspaceId: task.workspaceId,
    title: "Soak content",
    body: "soak",
    platformVariants: {
      facebook: undefined,
      instagram: undefined,
      telegram: "soak",
      whatsapp: undefined,
      linkedin: undefined,
      tiktok: undefined,
    },
    approvalStatus: "approved",
    tags: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const campaign: Campaign = {
    id: task.campaignId,
    workspaceId: task.workspaceId,
    name: "Soak campaign",
    status: "running",
    accountIds: [task.accountId],
    contentIds: [task.contentId!],
    taskCount: 1,
    createdAt: timestamp,
  };
  const approval: Approval = {
    id: `soak-approval-${cycle}`,
    workspaceId: task.workspaceId,
    contentId: task.contentId!,
    requestedBy: "local-user",
    reviewerIds: ["local-user"],
    status: "approved",
    decidedBy: "local-user",
    decidedAt: timestamp,
    note: "soak",
  };

  const policy = evaluateExecutionPolicy({
    account,
    campaign,
    task: { ...task, status: "running" },
    content,
    approval,
    actionsToday: cycle % 10,
    dailyLimit: 10,
    consecutiveFailures: 0,
    circuitBreakerThreshold: 3,
  });
  if (!policy.allowed) fail(`policy unexpectedly blocked cycle ${cycle}: ${policy.reason}`);

  const blocked = evaluateExecutionPolicy({
    account,
    campaign,
    task: { ...task, status: "running" },
    content,
    approval,
    actionsToday: 10,
    dailyLimit: 10,
    consecutiveFailures: 0,
    circuitBreakerThreshold: 3,
  });
  if (blocked.allowed || blocked.reason !== "daily_limit_reached") {
    fail("daily limit invariant failed");
  }

  const queue = new TaskQueue({
    retryPolicy: {
      maxAttempts: 3,
      baseDelayMs: 1_000,
      maxDelayMs: 60_000,
    },
  });
  queue.enqueue(task);

  let duplicateBlocked = false;
  try {
    queue.enqueue(task);
  } catch {
    duplicateBlocked = true;
  }
  if (!duplicateBlocked) fail("queue idempotency invariant failed");

  const claimed = queue.claimNext(timestamp);
  if (!claimed || claimed.status !== "running") fail("queue claim invariant failed");

  const retry = queue.fail(claimed.id, timestamp);
  if (retry.status !== "pending" || retry.attempts !== 1) {
    fail("queue retry invariant failed");
  }

  const chain = new AuditIntegrityChain();
  void chain;
  const events = [
    { id: `audit-${cycle}-1`, actor: "system" as const, category: "task" as const, action: "soak.start", outcome: "success" as const },
    { id: `audit-${cycle}-2`, actor: "system" as const, category: "task" as const, action: "soak.complete", outcome: "success" as const },
  ];
  for (const event of events) {
    // append/verify below is kept async so the soak loop remains deterministic.
    // The await is handled by the async wrapper.
    void event;
  }
}

async function runAuditInvariant(cycle: number): Promise<void> {
  const chain = new AuditIntegrityChain();
  const timestamp = new Date().toISOString();
  await chain.append({
    id: `audit-${cycle}-1`,
    timestamp,
    workspaceId: "soak-workspace",
    category: "task",
    action: "soak.start",
    outcome: "success",
    actor: "system",
    entityId: `soak-task-${cycle}`,
    metadata: { cycle },
  });
  await chain.append({
    id: `audit-${cycle}-2`,
    timestamp,
    workspaceId: "soak-workspace",
    category: "task",
    action: "soak.complete",
    outcome: "success",
    actor: "system",
    entityId: `soak-task-${cycle}`,
    metadata: { cycle },
  });
  if (!(await chain.verify())) fail("audit integrity invariant failed");
}

async function waitForHealth(): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 30_000) {
    if (server?.exitCode !== null && server?.exitCode !== undefined) {
      fail(`server exited before health check (code ${server.exitCode})`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (response.ok) return;
    } catch {
      // keep probing
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  fail("server did not become healthy within 30 seconds");
}

async function terminateProcess(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return;

  if (child.pid && platform() !== "win32") {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      try {
        child.kill("SIGTERM");
      } catch {}
    }
  } else {
    try {
      child.kill("SIGTERM");
    } catch {}
  }

  await new Promise<void>((resolve) => {
    if (child.exitCode !== null) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, 5_000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });

  if (child.exitCode === null) {
    if (child.pid && platform() !== "win32") {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {}
    } else {
      try {
        child.kill("SIGKILL");
      } catch {}
    }
    await new Promise<void>((resolve) => {
      if (child.exitCode !== null) {
        resolve();
        return;
      }
      const timer = setTimeout(resolve, 2_000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  if (child.exitCode === null) fail("soak server process did not terminate");
}

async function main(): Promise<void> {
  console.log(
    `soak: ${minutes} min against production runtime on :${port} (RSS budget ${RSS_BUDGET_MB} MB)`,
  );
  server = spawn(
    process.execPath,
    [join(root, "node_modules", "tsx", "dist", "cli.mjs"), join(root, "server.ts")],
    {
      cwd: root,
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: String(port),
        RUNTIME_HOST: "127.0.0.1",
        OLLAMA_BASE_URL: "http://127.0.0.1:9",
      },
      stdio: ["ignore", "ignore", "pipe"],
      detached: platform() !== "win32",
    },
  );
  let stderr = "";
  server.stderr?.on("data", (chunk) => {
    stderr += String(chunk);
  });
  server.on("error", (error) => {
    failures.push(`server spawn error: ${error.message}`);
  });

  await waitForHealth();

  let lastSample = 0;

  while (Date.now() < deadline) {
    if (server.exitCode !== null) fail(`server exited with code ${server.exitCode}`);

    cycles += 1;

    try {
      const health = await fetch(`http://127.0.0.1:${port}/api/health`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (!health.ok) {
        healthFailures += 1;
        consecutiveHealthFailures += 1;
        log({ cycle: cycles, health: health.status, consecutiveHealthFailures });
      } else {
        healthOk += 1;
        consecutiveHealthFailures = 0;
        const body: unknown = await health.json();
        if (
          typeof body !== "object" ||
          body === null ||
          (body as { provider?: unknown }).provider !== "ollama-local"
        ) {
          fail("health provider contract mismatch");
        }
      }
    } catch (error) {
      healthFailures += 1;
      consecutiveHealthFailures += 1;
      log({
        cycle: cycles,
        health: "network_error",
        error: error instanceof Error ? error.message : String(error),
        consecutiveHealthFailures,
      });
    }
    if (consecutiveHealthFailures >= 3) fail("three consecutive health failures");

    try {
      const response = await fetch(`http://127.0.0.1:${port}/`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) {
        staticFailures += 1;
        consecutiveStaticFailures += 1;
      } else {
        staticOk += 1;
        consecutiveStaticFailures = 0;
      }
      log({ cycle: cycles, staticOk, staticFailures, consecutiveStaticFailures });
    } catch {
      staticFailures += 1;
      consecutiveStaticFailures += 1;
      log({ cycle: cycles, static: "network_error", consecutiveStaticFailures });
    }
    if (consecutiveStaticFailures >= 3) fail("three consecutive static delivery failures");

    if (cycles % 4 === 0) {
      chatChecks += 1;
      try {
        const chat = await fetch(`http://127.0.0.1:${port}/api/chat`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: [{ role: "user", text: "soak ping" }] }),
          signal: AbortSignal.timeout(5_000),
        });
        if (chat.status !== 502) {
          chatFailures += 1;
          consecutiveChatFailures += 1;
          log({ cycle: cycles, chat: chat.status, consecutiveChatFailures });
        } else {
          consecutiveChatFailures = 0;
        }
        await chat.arrayBuffer();
      } catch (error) {
        chatFailures += 1;
        consecutiveChatFailures += 1;
        log({
          cycle: cycles,
          chat: "network_error",
          error: error instanceof Error ? error.message : String(error),
          consecutiveChatFailures,
        });
      }
      if (consecutiveChatFailures >= 3) fail("three consecutive AI error-path failures");
    }

    runCoreInvariantWorkload(cycles);
    await runAuditInvariant(cycles);

    if (Date.now() - lastSample >= 15_000) {
      lastSample = Date.now();
      const currentRss = server.pid ? rssMb(server.pid) : 0;
      if (currentRss > 0) {
        if (rssFirst === 0) rssFirst = currentRss;
        rssLast = currentRss;
        rssMin = Math.min(rssMin, currentRss);
        rssMax = Math.max(rssMax, currentRss);
        log({
          cycle: cycles,
          rssMb: Math.round(currentRss),
          healthOk,
          staticOk,
          chatChecks,
        });
        if (currentRss > RSS_BUDGET_MB) {
          fail(`RSS ${currentRss.toFixed(1)} MB exceeded budget`);
        }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, CYCLE_MS));
  }

  if (stderr.trim()) log({ serverStderr: stderr.slice(-4_000) });
}

main()
  .then(async () => {
    const summary = {
      runId,
      minutes,
      cycles,
      healthOk,
      healthFailures,
      consecutiveHealthFailures,
      staticOk,
      staticFailures,
      consecutiveStaticFailures,
      chatChecks,
      chatFailures,
      consecutiveChatFailures,
      rssMinMb: Number.isFinite(rssMin) ? Math.round(rssMin) : null,
      rssMaxMb: rssMax ? Math.round(rssMax) : null,
      rssFirstMb: rssFirst ? Math.round(rssFirst) : null,
      rssLastMb: rssLast ? Math.round(rssLast) : null,
      rssBudgetMb: RSS_BUDGET_MB,
      failures,
      ok: failures.length === 0,
      finishedAt: new Date().toISOString(),
    };
    if (server) await terminateProcess(server);
    jsonl.end();
    writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + "\n", "utf8");
    console.log(JSON.stringify(summary, null, 2));
    process.exit(summary.ok ? 0 : 1);
  })
  .catch(async (error: unknown) => {
    if (server) {
      try {
        await terminateProcess(server);
      } catch {}
    }
    jsonl.end();
    const message = error instanceof Error ? error.message : String(error);
    console.error(`SOAK FAILED: ${message}`);
    if (stderrHint(server)) {
      console.error(stderrHint(server));
    }
    process.exit(1);
  });

function stderrHint(child: ChildProcess | undefined): string {
  return child?.pid ? `See captured runtime stderr for PID ${child.pid}.` : "";
}
