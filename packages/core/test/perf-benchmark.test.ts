import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../..");
const TSX_CLI = join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
const WORKER = join(HERE, "fixtures", "perf-memory-worker.mjs");

// Budgets: production startup measures ~1.9-2.3s idle and ~5s under full
// parallel-suite load; 8s gives contention headroom while still failing
// regressions like a blocking startup network call. RSS measures ~71-78MB.
const STARTUP_BUDGET_MS = 8000;
const RSS_BUDGET_BYTES = 200 * 1024 * 1024;
const HEAP_BUDGET_BYTES = 100 * 1024 * 1024;

function probeFreePort(): Promise<number> {
  // This machine has a dead TCP range (45000-48999, EADDRINUSE with no
  // listener), so never hardcode a port: probe candidates until one binds.
  return new Promise((resolvePort, rejectPort) => {
    let candidate = 34560 + Math.floor(Math.random() * 400);
    const attempt = (): void => {
      const server = createServer();
      server.once("error", () => {
        candidate += 1;
        if (candidate > 34999) {
          rejectPort(new Error("no free port found"));
          return;
        }
        attempt();
      });
      server.listen(candidate, "127.0.0.1", () => {
        server.close(() => resolvePort(candidate));
      });
    };
    attempt();
  });
}

function killTree(child: ReturnType<typeof spawn>): void {
  if (process.platform === "win32" && child.pid !== undefined) {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
  } else {
    child.kill("SIGKILL");
  }
}

function waitForHealth(
  url: string,
  timeoutMs: number,
  getDiagnostics: () => string,
): Promise<number> {
  const started = Date.now();
  return new Promise((resolveReady, rejectReady) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };
    const attempt = async (): Promise<void> => {
      try {
        const res = await fetch(url);
        if (res.ok) {
          finish(() => resolveReady(Date.now() - started));
          return;
        }
      } catch {
        // Server not accepting connections yet; retry below.
      }
      if (Date.now() - started > timeoutMs) {
        finish(() =>
          rejectReady(
            new Error(
              `health endpoint not ready within ${timeoutMs}ms${getDiagnostics()}`,
            ),
          ),
        );
        return;
      }
      setTimeout(() => void attempt(), 50);
    };
    void attempt();
  });
}

describe("performance benchmarks (PERF-01, PERF-02)", () => {
  it("production server reaches /api/health within the startup budget", async () => {
    const port = await probeFreePort();
    let stderr = "";
    const child = spawn(process.execPath, [TSX_CLI, "server.ts"], {
      cwd: ROOT,
      env: { ...process.env, PORT: String(port), NODE_ENV: "production" },
      stdio: ["ignore", "ignore", "pipe"],
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-2000);
    });

    try {
      const elapsed = await waitForHealth(
        `http://127.0.0.1:${port}/api/health`,
        20000,
        () => `; server stderr: ${stderr.trim() || "(empty)"}`,
      );
      // Recorded benchmark: production startup (process spawn → first
      // successful health response), asserted against the budget so
      // regressions fail the suite. Dev-mode Vite startup is excluded.
      expect(elapsed).toBeLessThanOrEqual(STARTUP_BUDGET_MS);
      console.log(
        `[PERF-01] startup=${elapsed}ms budget=${STARTUP_BUDGET_MS}ms`,
      );
    } finally {
      killTree(child);
    }
  }, 40000);

  it("core workload (1k contacts / 500 tasks / 500 messages) stays within the memory budget", async () => {
    const dir = mkdtempSync(join(tmpdir(), "orbit-perf-"));
    try {
      const output = await new Promise<string>((resolveReady, rejectReady) => {
        const child = spawn(
          process.execPath,
          ["--experimental-transform-types", WORKER, dir],
          { stdio: ["ignore", "pipe", "pipe"] },
        );
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (chunk: Buffer) => {
          stdout += chunk.toString();
        });
        child.stderr.on("data", (chunk: Buffer) => {
          stderr += chunk.toString();
        });
        child.on("error", rejectReady);
        child.on("close", (code) => {
          if (code === 0) resolveReady(stdout);
          else rejectReady(new Error(`worker exited ${code}: ${stderr}`));
        });
      });

      const jsonLine = output
        .split(/\r?\n/)
        .filter((line) => line.startsWith("{"))
        .pop();
      expect(jsonLine, `no JSON result in worker output: ${output}`).toBeTruthy();
      const result = JSON.parse(jsonLine!) as {
        rss: number;
        heapUsed: number;
        contacts: number;
        tasks: number;
        messages: number;
        media: number;
        variants: number;
      };

      // Prove the workload actually ran before trusting the memory number.
      expect(result.contacts).toBe(1000);
      expect(result.tasks).toBe(500);
      expect(result.messages).toBe(500);
      expect(result.media).toBe(200);
      expect(result.variants).toBe(100);

      expect(result.rss).toBeLessThanOrEqual(RSS_BUDGET_BYTES);
      expect(result.heapUsed).toBeLessThanOrEqual(HEAP_BUDGET_BYTES);
      console.log(
        `[PERF-02] rss=${(result.rss / 1048576).toFixed(1)}MB heap=${(result.heapUsed / 1048576).toFixed(1)}MB budgets=${RSS_BUDGET_BYTES / 1048576}/${HEAP_BUDGET_BYTES / 1048576}MB`,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60000);
});
