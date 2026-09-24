import { createServer } from "node:http";
import { spawn } from "node:child_process";

const ollamaPort = "3110";

async function waitForChildExit(child, timeoutMs = 3_000) {
  if (child.exitCode !== null) return;
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}



const { spawnSync } = await import("node:child_process");
let capturedOllamaBody = null;
process.once("exit", () => { ollamaServer.close(); });
const ollamaServer = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/api/tags") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ models: [{ name: "llama3.2:3b" }] }));
    return;
  }

  if (req.method === "POST" && req.url === "/api/chat") {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        capturedOllamaBody = JSON.parse(body);
      } catch {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "invalid fake ollama request" }));
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        model: capturedOllamaBody?.model ?? "llama3.2:3b",
        message: { role: "assistant", content: "fake ollama response" },
      }));
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

await new Promise((resolve, reject) => {
  ollamaServer.once("error", reject);
  ollamaServer.listen(Number(ollamaPort), "127.0.0.1", resolve);
});

const port = "3101";

for (const url of [
  "http://user:password@example.com:11434",
  "http://example.com:11434",
]) {
  const probe = spawnSync("pnpm", ["exec", "tsx", "server.ts"], {
    env: { ...process.env, OLLAMA_BASE_URL: url, PORT: "3199" },
    encoding: "utf8",
  });
  if (probe.status === 0 || !/OLLAMA_BASE_URL/.test((probe.stderr ?? "") + (probe.stdout ?? ""))) {
    throw new Error("runtime must reject unsafe Ollama endpoint: " + url);
  }
}
const child = spawn("pnpm", ["runtime:start"], {
  env: {
    ...process.env,
    PORT: port,
    RUNTIME_HOST: "127.0.0.1",
    OLLAMA_BASE_URL: `http://127.0.0.1:${ollamaPort}`,
  },
  stdio: ["ignore", "pipe", "pipe"],
  shell: process.platform === "win32",
});

let logs = "";
child.stdout.on("data", (chunk) => {
  logs += String(chunk);
});
child.stderr.on("data", (chunk) => {
  logs += String(chunk);
});

const deadline = Date.now() + 15_000;
let response;
let lastError = "runtime did not respond";

try {
  while (Date.now() < deadline) {
    try {
      response = await fetch(`http://127.0.0.1:${port}/api/health`);
      break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  if (!response) {
    throw new Error(lastError);
  }

  const body = await response.json();
  if (response.status !== 200) {
    throw new Error(`health returned HTTP ${response.status}`);
  }
  if (body?.provider !== "ollama-local") {
    throw new Error("health provider contract mismatch");
  }
  if (!["ok", "degraded"].includes(body?.status)) {
    throw new Error("health status contract mismatch");
  }
  const loopbackBrowserBlocked = await fetch(`http://127.0.0.1:${port}/api/health`, {
    headers: { Origin: "https://untrusted.example" },
  });
  if (loopbackBrowserBlocked.status !== 403) {
    throw new Error("loopback runtime must reject unconfigured browser origins");
  }

  const tauriOriginHealth = await fetch(`http://127.0.0.1:${port}/api/health`, {
    headers: { Origin: "http://tauri.localhost" },
  });
  if (tauriOriginHealth.status !== 200) {
    throw new Error("official Tauri webview origin must be allowed by default");
  }

  const generation = await fetch(`http://127.0.0.1:${port}/api/generate-content`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      topic: "اختبار ORBIT",
      dialect: "فصحى مبسطة",
      tone: "احترافي",
      targetAudience: "اختبار",
    }),
  });
  if (generation.status !== 200) {
    throw new Error(`generation returned HTTP ${generation.status}`);
  }
  if (!capturedOllamaBody?.options || capturedOllamaBody.options.num_ctx !== 4096) {
    throw new Error("Ollama context budget contract mismatch");
  }
  if (capturedOllamaBody.model !== "llama3.2:3b") {
    throw new Error("resource-aware default model contract mismatch");
  }

  console.log("runtime AI smoke passed", JSON.stringify({
    health: body,
    model: capturedOllamaBody.model,
    num_ctx: capturedOllamaBody.options.num_ctx,
  }));
} finally {
  child.kill("SIGTERM");
  await waitForChildExit(child);
  if (child.exitCode !== null && child.exitCode !== 0) {
    console.error(logs);
    throw new Error(`runtime process exited with code ${child.exitCode}`);
  }
}


const authPort = "3102";
const authToken = "orbit-test-token";
const authChild = spawn("pnpm", ["runtime:start"], {
  env: {
    ...process.env,
    PORT: authPort,
    RUNTIME_HOST: "0.0.0.0",
    RUNTIME_AUTH_TOKEN: authToken,
    RUNTIME_ALLOWED_ORIGINS: "https://allowed.example",
    RUNTIME_RATE_LIMIT: "2",
    OLLAMA_BASE_URL: "http://127.0.0.1:9",
  },
  stdio: ["ignore", "pipe", "pipe"],
  shell: process.platform === "win32",
});
let authLogs = "";
authChild.stdout.on("data", (chunk) => { authLogs += String(chunk); });
authChild.stderr.on("data", (chunk) => { authLogs += String(chunk); });

try {
  let authReady = false;
  const authDeadline = Date.now() + 15_000;
  while (Date.now() < authDeadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${authPort}/api/health`);
      if (response.status === 503) {
        authReady = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!authReady) throw new Error("LAN runtime did not enforce missing-token block");

  const unauthorized = await fetch(`http://127.0.0.1:${authPort}/api/health`);
  if (unauthorized.status !== 503) throw new Error("expected 503 without LAN token");

  const wrong = await fetch(`http://127.0.0.1:${authPort}/api/health`, {
    headers: { Authorization: "Bearer wrong-token" },
  });
  if (wrong.status !== 401) throw new Error("expected 401 with wrong LAN token");

  const authorized = await fetch(`http://127.0.0.1:${authPort}/api/health`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (authorized.status !== 200) throw new Error("expected 200 with correct LAN token");

  const preflightAllowed = await fetch(`http://127.0.0.1:${authPort}/api/health`, {
    method: "OPTIONS",
    headers: {
      Origin: "https://allowed.example",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization, content-type",
    },
  });
  if (preflightAllowed.status !== 204) throw new Error("expected 204 for allowed CORS preflight");
  if (preflightAllowed.headers.get("access-control-allow-origin") !== "https://allowed.example") {
    throw new Error("allowed CORS origin header mismatch");
  }
  if (!preflightAllowed.headers.get("access-control-allow-methods")?.includes("POST")) {
    throw new Error("allowed CORS methods header mismatch");
  }

  const preflightBlocked = await fetch(`http://127.0.0.1:${authPort}/api/health`, {
    method: "OPTIONS",
    headers: {
      Origin: "https://blocked.example",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization, content-type",
    },
  });
  if (preflightBlocked.status !== 403) throw new Error("expected 403 for blocked CORS preflight");

  const blockedOrigin = await fetch(`http://127.0.0.1:${authPort}/api/health`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
      Origin: "https://blocked.example",
    },
  });
  if (blockedOrigin.status !== 403) throw new Error("expected 403 for disallowed browser origin");

  const allowedOrigin = await fetch(`http://127.0.0.1:${authPort}/api/health`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
      Origin: "https://allowed.example",
    },
  });
  if (allowedOrigin.status !== 200) throw new Error("expected 200 for allowed browser origin");

  const rateOne = await fetch(`http://127.0.0.1:${authPort}/api/health`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (![200, 429].includes(rateOne.status)) throw new Error("unexpected first rate-limit response");

  const rateTwo = await fetch(`http://127.0.0.1:${authPort}/api/health`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (rateTwo.status !== 429) throw new Error("expected 429 after exceeding runtime rate limit");

  console.log("runtime LAN perimeter smoke passed");
} finally {
  authChild.kill("SIGTERM");
  await waitForChildExit(authChild);
  if (authChild.exitCode !== null && authChild.exitCode !== 0) {
    console.error(authLogs);
    throw new Error(`LAN runtime exited with code ${authChild.exitCode}`);
  }
}

await new Promise((resolve) => ollamaServer.close(() => resolve()));
