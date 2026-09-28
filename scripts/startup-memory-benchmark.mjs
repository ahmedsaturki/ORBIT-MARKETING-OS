import { spawn, execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const root = process.cwd();
const port = 34891;
const startedAt = performance.now();

function rssMb(pid) {
  if (process.platform === "linux") {
    const status = readFileSync("/proc/" + pid + "/status", "utf8");
    const match = status.match(/^VmRSS:\s+(\d+)\s+kB$/m);
    return match ? Number(match[1]) / 1024 : 0;
  }

  if (process.platform === "darwin") {
    const value = execFileSync("ps", ["-o", "rss=", "-p", String(pid)], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const kb = Number(value);
    return Number.isFinite(kb) ? kb / 1024 : 0;
  }

  const out = execFileSync(
    "tasklist",
    ["/FI", "PID eq " + pid, "/FO", "CSV", "/NH"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  );
  const match = out.match(/"([\d,]+) K"/);
  return match ? Number(match[1].replaceAll(",", "")) / 1024 : 0;
}

const child = spawn(
  process.execPath,
  ["node_modules/tsx/dist/cli.mjs", "server.ts"],
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
  },
);

let stderr = "";
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
    if (child.exitCode !== null) {
      throw new Error(
        "runtime exited during startup with code " + child.exitCode,
      );
    }

    const rss = child.pid ? rssMb(child.pid) : 0;
    if (rss > 0) peakRssMb = Math.max(peakRssMb, rss);
    if (rss > 0) samples += 1;

    try {
      const response = await fetch("http://127.0.0.1:" + port + "/api/health", {
        signal: AbortSignal.timeout(1_000),
      });
      if (response.ok) {
        healthy = true;
        startupMs = performance.now() - startedAt;
        break;
      }
    } catch {}

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  if (!healthy) {
    throw new Error("runtime did not become healthy within 30 seconds");
  }

  for (let index = 0; index < 10; index += 1) {
    const rss = child.pid ? rssMb(child.pid) : 0;
    if (rss > 0) {
      peakRssMb = Math.max(peakRssMb, rss);
      samples += 1;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const result = {
    dataset: "local runtime startup",
    startup_ms: Number(startupMs?.toFixed(2)),
    peak_rss_mb: Number(peakRssMb.toFixed(2)),
    rss_samples: samples,
    host: "127.0.0.1",
    provider: "ollama-local",
    port,
  };

  console.log("STARTUP_MEMORY_BENCHMARK_JSON " + JSON.stringify(result));
} finally {
  if (child.exitCode === null) {
    child.kill("SIGTERM");
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 5_000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  if (child.exitCode === null) {
    child.kill("SIGKILL");
    await new Promise((resolve) => child.once("exit", resolve));
  }

  if (stderr.trim() && child.exitCode !== 0) {
    console.error(stderr.slice(-4_000));
  }
}
