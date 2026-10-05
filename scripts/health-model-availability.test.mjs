import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
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

// Bind an ephemeral port, read it back, then release it. There is an inherent
// race between releasing and the runtime re-binding, which the banner check in
// startRuntime exists to catch: if the port were taken in between, the runtime
// would fail to start and the banner would never match.
async function findFreePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const address = probe.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve) => probe.close(resolve));
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("could not allocate a free port");
  }
  return port;
}

async function startRuntime(ollamaPort, extraEnv = {}) {
  const port = await findFreePort();
  const child = spawn(process.execPath, ["--import", "tsx", "server.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      RUNTIME_HOST: "127.0.0.1",
      RUNTIME_AUTH_TOKEN: "",
      OLLAMA_BASE_URL: `http://127.0.0.1:${ollamaPort}`,
      ...extraEnv,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  // Pick the free port in this process and pass it explicitly, then read it
  // back from the banner to confirm the runtime bound where we expected.
  //
  // Two approaches were rejected here. `netstat -ano` is what this used to do,
  // and it only ever worked on Windows: that is the only variant that emits
  // LISTENING rows carrying a trailing PID, so findListeningPort returned 0 on
  // Linux and macOS and startRuntime threw before any health assertion ran.
  // Reading the port from the banner does not work either, because with
  // PORT=0 the banner echoes the configured value rather than the bound one.
  let observedPort = 0;
  await new Promise((resolve, reject) => {
    let buffer = "";
    const timer = setTimeout(
      () => reject(new Error("runtime start timeout")),
      20_000,
    );
    child.stdout.on("data", (chunk) => {
      buffer += String(chunk);
      const match = /listening on (\S+):(\d+)/i.exec(buffer);
      if (match) {
        clearTimeout(timer);
        observedPort = Number(match[2]);
        resolve();
      }
    });
    child.on("error", reject);
  });

  if (observedPort !== port) {
    throw new Error(
      `runtime bound port ${observedPort} but ${port} was requested`,
    );
  }
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
