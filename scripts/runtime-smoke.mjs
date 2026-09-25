import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";

const OLLAMA_PORT = 3110;
const RUNTIME_PORT = 3101;
const AUTH_PORT = 3102;
const BRUTE_FORCE_PORT = 3103;

async function waitForChildExit(child, timeoutMs = 5_000) {
  if (child.exitCode !== null) return;
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

async function terminateChild(child) {
  if (child.pid === undefined) return;

  if (child.exitCode === null) {
    try {
      if (process.platform !== "win32") {
        process.kill(-child.pid, "SIGTERM");
      } else {
        child.kill("SIGTERM");
      }
    } catch {}
    await waitForChildExit(child, 2_500);
  }

  if (child.exitCode === null) {
    try {
      if (process.platform !== "win32") {
        process.kill(-child.pid, "SIGKILL");
      } else {
        child.kill("SIGKILL");
      }
    } catch {}
    await waitForChildExit(child, 2_500);
  }

  if (child.exitCode === null && process.platform !== "win32") {
    try {
      process.kill(child.pid, "SIGKILL");
    } catch {}
  }

  if (child.exitCode === null) {
    // A direct Node child may report the exit event slightly after SIGKILL;
    // the OS signal above is the authoritative cleanup mechanism.
    await waitForChildExit(child, 500);
  }
}

const TSX_CLI = path.join(
  process.cwd(),
  "node_modules",
  "tsx",
  "dist",
  "cli.mjs",
);

function spawnRuntime(env) {
  const childEnv = {
    ...env,
  };
  const child = spawn(process.execPath, [TSX_CLI, "server.ts"], {
    env: childEnv,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
    detached: process.platform !== "win32",
    windowsHide: true,
  });
  child.on("error", (error) => {
    // Prevent an unhandled ChildProcess 'error' from masking the actual smoke result.
    child.__spawnError = error;
  });
  return child;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

let capturedOllamaBody = null;
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
  ollamaServer.listen(OLLAMA_PORT, "127.0.0.1", resolve);
});
process.once("exit", () => ollamaServer.close());

for (const url of [
  "http://user:password@example.com:11434",
  "http://example.com:11434",
  "https://example.com:11434",
]) {
  const probe = spawnSync(process.execPath, [TSX_CLI, "server.ts"], {
    env: { ...process.env, OLLAMA_BASE_URL: url, PORT: "3199" },
    encoding: "utf8",
  });
  const output = (probe.stderr ?? "") + (probe.stdout ?? "");
  assert(probe.status !== 0 && /OLLAMA_BASE_URL/.test(output),
    "runtime must reject unsafe Ollama endpoint: " + url);
}

const child = spawnRuntime({
  env: {
    ...process.env,
    PORT: String(RUNTIME_PORT),
    RUNTIME_HOST: "127.0.0.1",
    OLLAMA_BASE_URL: "http://127.0.0.1:" + OLLAMA_PORT,
  },
  stdio: ["ignore", "pipe", "pipe"],
  shell: process.platform === "win32",
});
let logs = "";
child.stdout.on("data", (chunk) => { logs += String(chunk); });
child.stderr.on("data", (chunk) => { logs += String(chunk); });

try {
  let response;
  let lastError = "runtime did not respond";
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      response = await fetch("http://127.0.0.1:" + RUNTIME_PORT + "/api/health");
      break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  if (!response) throw new Error(lastError);

  const body = await response.json();
  assert(response.status === 200, "health returned HTTP " + response.status);
  assert(body?.provider === "ollama-local", "health provider contract mismatch");
  assert(["ok", "degraded"].includes(body?.status), "health status contract mismatch");
  assert(body?.ai?.status === "ok", "fake Ollama fixture must report healthy AI state");

  const loopbackBrowserBlocked = await fetch(
    "http://127.0.0.1:" + RUNTIME_PORT + "/api/health",
    { headers: { Origin: "https://untrusted.example" } },
  );
  assert(loopbackBrowserBlocked.status === 403, "loopback runtime must reject untrusted browser origins");

  const tauriOriginHealth = await fetch(
    "http://127.0.0.1:" + RUNTIME_PORT + "/api/health",
    { headers: { Origin: "http://tauri.localhost" } },
  );
  assert(tauriOriginHealth.status === 200, "Tauri webview origin must be allowed");

  const tauriDevOriginHealth = await fetch(
    "http://127.0.0.1:" + RUNTIME_PORT + "/api/health",
    { headers: { Origin: "http://127.0.0.1:1420" } },
  );
  assert(tauriDevOriginHealth.status === 200, "Tauri development origin must be allowed");

  const generation = await fetch(
    "http://127.0.0.1:" + RUNTIME_PORT + "/api/generate-content",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        topic: "اختبار ORBIT",
        dialect: "فصحى مبسطة",
        tone: "احترافي",
        targetAudience: "اختبار",
      }),
    },
  );
  assert(generation.status === 200, "generation returned HTTP " + generation.status);
  assert(capturedOllamaBody?.options?.num_ctx === 4096, "Ollama context budget contract mismatch");
  assert(capturedOllamaBody?.model === "llama3.2:3b", "default model contract mismatch");

  const chat = await fetch(
    "http://127.0.0.1:" + RUNTIME_PORT + "/api/chat",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", text: "اختبار محادثة ORBIT" }],
        roleId: "copywriter",
        profile: "fast",
      }),
    },
  );
  assert(chat.status === 200, "chat returned HTTP " + chat.status);
  const chatBody = await chat.json();
  assert(chatBody?.provider === "ollama-local" && chatBody?.text === "fake ollama response",
    "chat response contract mismatch");
  assert(Array.isArray(capturedOllamaBody?.messages) &&
    capturedOllamaBody.messages.at(-1)?.content === "اختبار محادثة ORBIT",
    "chat Ollama payload contract mismatch");

  const imageAnalysis = await fetch(
    "http://127.0.0.1:" + RUNTIME_PORT + "/api/analyze-image",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ imageBase64: "AAAA", analysisType: "comprehensive" }),
    },
  );
  assert(imageAnalysis.status === 503, "image analysis must require configured vision model");

  console.log("runtime AI smoke passed", JSON.stringify({
    health: body,
    model: capturedOllamaBody?.model,
    num_ctx: capturedOllamaBody?.options?.num_ctx,
  }));
} finally {
  await terminateChild(child);
  if (child.exitCode !== null && child.exitCode !== 0) {
    console.error(logs);
    throw new Error("runtime process exited with code " + child.exitCode);
  }
}

const missingTokenChild = spawnRuntime({
  env: {
    ...process.env,
    PORT: String(AUTH_PORT),
    RUNTIME_HOST: "0.0.0.0",
    RUNTIME_AUTH_TOKEN: "",
    RUNTIME_ALLOWED_ORIGINS: "",
    RUNTIME_RATE_LIMIT: "6",
    OLLAMA_BASE_URL: `http://127.0.0.1:${OLLAMA_PORT}`,
  },
  stdio: ["ignore", "pipe", "pipe"],
  shell: process.platform === "win32",
});
let missingTokenLogs = "";
missingTokenChild.stdout.on("data", (chunk) => { missingTokenLogs += String(chunk); });
missingTokenChild.stderr.on("data", (chunk) => { missingTokenLogs += String(chunk); });

try {
  let missingReady = false;
  const missingDeadline = Date.now() + 15_000;
  while (Date.now() < missingDeadline) {
    try {
      const probe = await fetch("http://127.0.0.1:" + AUTH_PORT + "/api/health");
      if (probe.status === 503) {
        missingReady = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert(missingReady, "LAN runtime must reject startup without a configured token");
  const missingTokenResponse = await fetch(
    "http://127.0.0.1:" + AUTH_PORT + "/api/health",
  );
  assert(missingTokenResponse.status === 503, "expected 503 without LAN token configuration");
  console.log("runtime missing-token startup guard passed");
} finally {
  await terminateChild(missingTokenChild);
  if (missingTokenChild.exitCode !== null && missingTokenChild.exitCode !== 0) {
    console.error(missingTokenLogs);
    throw new Error("missing-token runtime exited with code " + missingTokenChild.exitCode);
  }
}

const authPort = AUTH_PORT + 2;
const authToken = "orbit-test-token";
const authChild = spawnRuntime({
  env: {
    ...process.env,
    PORT: String(authPort),
    RUNTIME_HOST: "0.0.0.0",
    RUNTIME_AUTH_TOKEN: authToken,
    RUNTIME_ALLOWED_ORIGINS: "https://allowed.example",
    RUNTIME_RATE_LIMIT: "6",
    OLLAMA_BASE_URL: `http://127.0.0.1:${OLLAMA_PORT}`,
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
      const probe = await fetch("http://127.0.0.1:" + authPort + "/api/health");
      if (probe.status === 401) {
        authReady = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert(authReady, "LAN runtime did not enforce configured-token perimeter");

  const unauthorized = await fetch("http://127.0.0.1:" + authPort + "/api/health");
  assert(unauthorized.status === 401, "expected 401 without LAN token");

  const wrong = await fetch("http://127.0.0.1:" + authPort + "/api/health", {
    headers: { Authorization: "Bearer wrong-token" },
  });
  assert(wrong.status === 401, "expected 401 with wrong LAN token");

  const oversized = await fetch("http://127.0.0.1:" + authPort + "/api/health", {
    headers: { Authorization: "Bearer " + "x".repeat(1025) },
  });
  assert(oversized.status === 401, "expected 401 for oversized bearer credential");

  const blockedOrigin = await fetch("http://127.0.0.1:" + authPort + "/api/health", {
    headers: {
      Authorization: "Bearer " + authToken,
      Origin: "https://blocked.example",
    },
  });
  assert(blockedOrigin.status === 403, "expected 403 for blocked origin");

  const allowedOrigin = await fetch("http://127.0.0.1:" + authPort + "/api/health", {
    headers: {
      Authorization: "Bearer " + authToken,
      Origin: "https://allowed.example",
    },
  });
  assert(allowedOrigin.status === 200, "expected 200 for allowed origin");

  const rateResponses = [];
  for (let index = 0; index < 3; index += 1) {
    const rateResponse = await fetch("http://127.0.0.1:" + authPort + "/api/health", {
      headers: { Authorization: "Bearer " + authToken },
    });
    rateResponses.push(rateResponse.status);
  }
  assert(rateResponses.at(-1) === 429, "expected 429 after exceeding runtime rate limit");
  console.log("runtime LAN perimeter smoke passed");
} finally {
  await terminateChild(authChild);
  if (authChild.exitCode !== null && authChild.exitCode !== 0) {
    console.error(authLogs);
    throw new Error("LAN runtime exited with code " + authChild.exitCode);
  }
}

const bruteForceChild = spawnRuntime({
  env: {
    ...process.env,
    PORT: String(BRUTE_FORCE_PORT),
    RUNTIME_HOST: "0.0.0.0",
    RUNTIME_AUTH_TOKEN: authToken,
    RUNTIME_RATE_LIMIT: "2",
    RUNTIME_ALLOWED_ORIGINS: "",
    OLLAMA_BASE_URL: `http://127.0.0.1:${OLLAMA_PORT}`,
  },
  stdio: ["ignore", "pipe", "pipe"],
  shell: process.platform === "win32",
});
let bruteForceLogs = "";
bruteForceChild.stdout.on("data", (chunk) => { bruteForceLogs += String(chunk); });
bruteForceChild.stderr.on("data", (chunk) => { bruteForceLogs += String(chunk); });

try {
  let ready = false;
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch("http://127.0.0.1:" + BRUTE_FORCE_PORT + "/api/health", {
        headers: { Authorization: "Bearer wrong-token" },
      });
      if (response.status === 401) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert(ready, "brute-force perimeter runtime did not start");

  const firstInvalid = await fetch("http://127.0.0.1:" + BRUTE_FORCE_PORT + "/api/health", {
    headers: { Authorization: "Bearer wrong-token" },
  });
  assert(firstInvalid.status === 401, "first invalid token should return 401");

  const secondInvalid = await fetch("http://127.0.0.1:" + BRUTE_FORCE_PORT + "/api/health", {
    headers: { Authorization: "Bearer wrong-token" },
  });
  assert(secondInvalid.status === 429, "repeated invalid tokens must be rate-limited");

  console.log("runtime invalid-token rate-limit smoke passed");
} finally {
  await terminateChild(bruteForceChild);
  if (bruteForceChild.exitCode !== null && bruteForceChild.exitCode !== 0) {
    console.error(bruteForceLogs);
    throw new Error("brute-force runtime exited with code " + bruteForceChild.exitCode);
  }
}

await new Promise((resolve) => ollamaServer.close(() => resolve()));
