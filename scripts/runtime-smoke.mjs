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

  const tauriDevOriginHealth = await fetch(`http://127.0.0.1:${port}/api/health`, {
    headers: { Origin: "http://127.0.0.1:1420" },
  });
  if (tauriDevOriginHealth.status !== 200) {
    throw new Error("Tauri development origin must be allowed by default");
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

  const chat = await fetch(`http://127.0.0.1:${port}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", text: "اختبار محادثة ORBIT" }],
      roleId: "copywriter",
      profile: "fast",
    }),
  });
  if (chat.status !== 200) {
    throw new Error(`chat returned HTTP ${chat.status}`);
  }
  const chatBody = await chat.json();
  if (chatBody?.provider !== "ollama-local" || chatBody?.text !== "fake ollama response") {
    throw new Error("chat response contract mismatch");
  }
  if (capturedOllamaBody.model !== "llama3.2:3b") {
    throw new Error("chat model contract mismatch");
  }
  if (!Array.isArray(capturedOllamaBody.messages) || capturedOllamaBody.messages.at(-1)?.content !== "اختبار محادثة ORBIT") {
    throw new Error("chat Ollama payload contract mismatch");
  }

  const imageAnalysis = await fetch(`http://127.0.0.1:${port}/api/analyze-image`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      imageBase64: "AAAA",
      analysisType: "comprehensive",
    }),
  });
  if (imageAnalysis.status !== 503) {
    throw new Error("image analysis must require an explicitly configured vision model");
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