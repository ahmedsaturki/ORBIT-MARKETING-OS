import { spawn } from "node:child_process";

const port = "3101";
const child = spawn("pnpm", ["runtime:start"], {
  env: {
    ...process.env,
    PORT: port,
    RUNTIME_HOST: "127.0.0.1",
    OLLAMA_BASE_URL: "http://127.0.0.1:9",
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
  if (body?.ai?.status !== "degraded") {
    throw new Error("offline Ollama fixture must report degraded AI state");
  }

  console.log("runtime smoke passed", JSON.stringify(body));
} finally {
  child.kill("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 100));
  if (child.exitCode !== null && child.exitCode !== 0) {
    console.error(logs);
    throw new Error(`runtime process exited with code ${child.exitCode}`);
  }
}
