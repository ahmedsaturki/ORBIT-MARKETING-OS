import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";

// Contract: /api/health must not report "ok" merely because Ollama is
// reachable. It must confirm the configured models are actually installed,
// because every AI call 404s otherwise while health still claims ok.

const source = await readFile("server.ts", "utf8");

for (const marker of [
  "const payload: unknown = await response.json();",
  "availableModels = models",
  "configuredModelsPresent = requiredModels.every((name) =>",
  'ollamaStatus = configuredModelsPresent ? "ok" : "degraded";',
  'modelAvailable: ollamaStatus === "ok",',
]) {
  assert.equal(
    source.includes(marker),
    true,
    `health must verify model availability, missing marker: ${marker}`,
  );
}

assert.equal(
  source.includes('ollamaStatus = response.ok ? "ok" : "degraded";'),
  false,
  "health must not treat a reachable Ollama as a healthy model",
);

function jsonBody(response, payload) {
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
}

async function startOllamaStub(tags) {
  const server = createServer((request, response) => {
    if (request.url === "/api/tags") {
      jsonBody(response, tags);
      return;
    }
    jsonBody(response, { ok: true });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return { server, port: server.address().port };
}

// PORT=0 lets the OS pick a free port, but the startup banner echoes the
// configured value rather than the bound one, so resolve the real port from
// the child's listening socket.
function findListeningPort(pid) {
  let output = "";
  try {
    output = execFileSync("netstat", ["-ano"], { encoding: "utf8" });
  } catch {
    return 0;
  }
  for (const row of output.split(/\r?\n/)) {
    if (row.includes("LISTENING") && row.trim().endsWith(String(pid))) {
      const port = Number(row.trim().split(/\s+/)[1].split(":")[1]);
      if (port > 0) return port;
    }
  }
  return 0;
}

async function startRuntime(ollamaPort, extraEnv = {}) {
  const child = spawn(process.execPath, ["--import", "tsx", "server.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: "0",
      RUNTIME_HOST: "127.0.0.1",
      RUNTIME_AUTH_TOKEN: "",
      OLLAMA_BASE_URL: `http://127.0.0.1:${ollamaPort}`,
      ...extraEnv,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  await new Promise((resolve, reject) => {
    let buffer = "";
    const timer = setTimeout(
      () => reject(new Error("runtime start timeout")),
      20_000,
    );
    child.stdout.on("data", (chunk) => {
      buffer += String(chunk);
      if (/listening on \S+:\d+/i.test(buffer)) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.on("error", reject);
  });

  let port = 0;
  for (let attempt = 0; attempt < 40 && port === 0; attempt += 1) {
    port = findListeningPort(child.pid);
    if (port === 0) {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  if (port === 0) throw new Error("could not determine runtime port");
  return { child, host: "127.0.0.1", port };
}

async function stop(child, server) {
  if (child && child.exitCode === null) {
    child.kill();
    await once(child, "exit").catch(() => {});
  }
  if (server) {
    server.close();
    await once(server, "close").catch(() => {});
  }
}

const MISSING = {
  OLLAMA_MODEL: "llama3.2:3b",
  OLLAMA_FAST_MODEL: "llama3.2:3b",
  OLLAMA_REASONING_MODEL: "llama3.2:3b",
};

// Case 1: configured model missing from Ollama -> degraded, not ok.
{
  const ollama = await startOllamaStub({
    models: [{ name: "some-other-model:1b" }],
  });
  const runtime = await startRuntime(ollama.port, MISSING);
  try {
    const response = await fetch(
      `http://${runtime.host}:${runtime.port}/api/health`,
    );
    const body = await response.json();
    assert.equal(body.status, "degraded", "missing model must degrade health");
    assert.equal(body.ai.modelAvailable, false);
    assert.equal(body.ai.status, "degraded");
    assert.deepEqual(
      body.ai.availableModels,
      ["some-other-model:1b"],
      "degraded health must list what is actually installed",
    );
    assert.ok(
      Array.isArray(body.ai.requiredModels) &&
        body.ai.requiredModels.length > 0,
      "degraded health must name the required models",
    );
  } finally {
    await stop(runtime.child, ollama.server);
  }
}

// Case 2: configured model installed -> ok.
{
  const ollama = await startOllamaStub({ models: [{ name: "llama3.2:3b" }] });
  const runtime = await startRuntime(ollama.port, MISSING);
  try {
    const response = await fetch(
      `http://${runtime.host}:${runtime.port}/api/health`,
    );
    const body = await response.json();
    assert.equal(body.status, "ok", "installed model must report ok");
    assert.equal(body.ai.modelAvailable, true);
    assert.equal(
      body.ai.availableModels,
      undefined,
      "healthy response must not leak the inventory",
    );
  } finally {
    await stop(runtime.child, ollama.server);
  }
}

// Case 3: Ollama unreachable -> degraded, server still answers.
{
  const probe = createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const deadPort = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));

  const runtime = await startRuntime(deadPort, MISSING);
  try {
    const response = await fetch(
      `http://${runtime.host}:${runtime.port}/api/health`,
    );
    const body = await response.json();
    assert.equal(
      body.status,
      "degraded",
      "unreachable Ollama must degrade health",
    );
    assert.equal(body.ai.modelAvailable, false);
  } finally {
    await stop(runtime.child, null);
  }
}

console.log("health_model_availability_contract=PASS");
