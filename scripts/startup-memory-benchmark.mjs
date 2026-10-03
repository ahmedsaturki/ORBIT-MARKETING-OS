import { spawn } from "node:child_process";
import { execFileTracked } from "./lib/exec.mjs";
import { createServer } from "node:net";
import { readFileSync } from "node:fs";

// Published performance budgets (docs/RELEASE_SCORECARD.md PERF-01/PERF-02).
// These are fail-closed enforcement: exceeding either throws after the
// measurement. Note the soak test deliberately uses a distinct 600 MB RSS
// ceiling for a long-running process (scripts/soak.ts); the 200 MB figure
// bounds startup-time peak RSS only.
const STARTUP_BUDGET_MS = 8000;
const RSS_BUDGET_MB = 200;

const root = process.cwd();

function rssMb(pid) {
  if (process.platform === "linux") {
    const status = readFileSync("/proc/" + pid + "/status", "utf8");
    const match = status.match(/^VmRSS:\s+(\d+)\s+kB$/m);
    return match ? Number(match[1]) / 1024 : 0;
  }

  if (process.platform === "darwin") {
    const value = execFileTracked("ps", ["-o", "rss=", "-p", String(pid)], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const kb = Number(value);
    return Number.isFinite(kb) ? kb / 1024 : 0;
  }

  const out = execFileTracked(
    "tasklist",
    ["/FI", "PID eq " + pid, "/FO", "CSV", "/NH"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  );
  const match = out.match(/"([\d,]+) K"/);
  return match ? Number(match[1].replaceAll(",", "")) / 1024 : 0;
}

async function allocatePort() {
  const probe = createServer();

  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });

  const address = probe.address();
  if (!address || typeof address === "string") {
    probe.close();
    throw new Error("could not allocate an isolated TCP port");
  }

  const port = address.port;

  await new Promise((resolve, reject) =>
    probe.close((error) => (error ? reject(error) : resolve())),
  );

  return port;
}

const port = await allocatePort();
const startedAt = performance.now();

const child = spawn(process.execPath, ["--import", "tsx", "server.ts"], {
  cwd: root,
  env: {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(port),
    RUNTIME_HOST: "127.0.0.1",
    OLLAMA_BASE_URL: "http://127.0.0.1:9",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let stdout = "";
let stderr = "";
let serverAnnounced = false;

child.stdout?.on("data", (chunk) => {
  stdout += String(chunk);
  if (stdout.includes("127.0.0.1:" + port)) {
    serverAnnounced = true;
  }
});

child.stderr?.on("data", (chunk) => {
  stderr += String(chunk);
});

const deadline = Date.now() + 30_000;
let healthy = false;
let startupMs = null;
let peakRssMb = 0;
let samples = 0;

try {
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(
        "runtime exited during startup before readiness: " +
          (child.exitCode ?? child.signalCode),
      );
    }

    const rss = child.pid ? rssMb(child.pid) : 0;
    if (rss > 0) peakRssMb = Math.max(peakRssMb, rss);
    if (rss > 0) samples += 1;

    try {
      const response = await fetch("http://127.0.0.1:" + port + "/api/health", {
        signal: AbortSignal.timeout(1_000),
      });
      if (response.ok && serverAnnounced) {
        healthy = true;
        startupMs = performance.now() - startedAt;
        break;
      }
    } catch {}

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  if (!healthy) {
    throw new Error(
      "launched runtime did not announce its listener and pass health within 30 seconds",
    );
  }

  for (let index = 0; index < 10; index += 1) {
    const rss = child.pid ? rssMb(child.pid) : 0;
    if (rss > 0) {
      peakRssMb = Math.max(peakRssMb, rss);
      samples += 1;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  if (startupMs !== null && startupMs > STARTUP_BUDGET_MS) {
    throw new Error(
      `startup budget breached: startup_ms=${startupMs.toFixed(2)} exceeds STARTUP_BUDGET_MS=${STARTUP_BUDGET_MS}`,
    );
  }
  if (peakRssMb > RSS_BUDGET_MB) {
    throw new Error(
      `RSS budget breached: peak_rss_mb=${peakRssMb.toFixed(2)} exceeds RSS_BUDGET_MB=${RSS_BUDGET_MB}`,
    );
  }

  const result = {
    dataset: "local runtime startup",
    startupBudgetMs: STARTUP_BUDGET_MS,
    rssBudgetMb: RSS_BUDGET_MB,
    startup_ms: Number(startupMs?.toFixed(2)),
    peak_rss_mb: Number(peakRssMb.toFixed(2)),
    rss_samples: samples,
    host: "127.0.0.1",
    port,
    server_announced: serverAnnounced,
    provider: "ollama-local",
  };

  console.log("STARTUP_MEMORY_BENCHMARK_JSON " + JSON.stringify(result));
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 5_000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await new Promise((resolve) => child.once("exit", resolve));
  }

  if (stderr.trim() && child.exitCode !== 0 && child.signalCode === null) {
    console.error(stderr.slice(-4_000));
  }
}
