import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeLocalImage,
  DEFAULT_RUNTIME_URL,
  fetchLocalRuntimeHealth,
  generateLocalContent,
  sendLocalChat,
} from "../src/lib/runtimeClient.ts";

test("local runtime health uses the loopback endpoint", async () => {
  const originalFetch = globalThis.fetch;
  let receivedUrl = "";

  globalThis.fetch = async (input) => {
    receivedUrl = String(input);
    return new Response(
      JSON.stringify({
        status: "ok",
        service: "Orbit Marketing OS Local Runtime",
        provider: "ollama-local",
        model: "llama3.2:3b",
        visionConfigured: false,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  try {
    const health = await fetchLocalRuntimeHealth();
    assert.equal(receivedUrl, DEFAULT_RUNTIME_URL + "/api/health");
    assert.equal(health.model, "llama3.2:3b");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("local chat sends typed messages and returns the model response", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: unknown = null;

  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body ?? "{}"));
    return new Response(
      JSON.stringify({
        text: "اقتراحات الحملة",
        modelUsed: "llama3.2:3b",
        provider: "ollama-local",
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  try {
    const result = await sendLocalChat([
      { role: "user", text: "اقترح زوايا للحملة" },
    ]);
    assert.equal(result.text, "اقتراحات الحملة");
    assert.deepEqual(requestBody, {
      messages: [{ role: "user", text: "اقترح زوايا للحملة" }],
      roleId: "marketing_strategist",
      profile: "balanced",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("content generation validates required topic and serializes the payload", async () => {
  await assert.rejects(
    () =>
      generateLocalContent({
        topic: "",
        dialect: "فصحى مبسطة",
        tone: "احترافي",
        targetAudience: "الجمهور العام",
      }),
    /topic is required/,
  );

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    assert.equal(body.topic, "حملة جديدة");
    assert.equal(body.targetAudience, "مشترو العقارات");
    return new Response(
      JSON.stringify({
        content: "حزمة محتوى",
        modelUsed: "llama3.2:3b",
        provider: "ollama-local",
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  try {
    const result = await generateLocalContent({
      topic: "حملة جديدة",
      dialect: "فصحى مبسطة",
      tone: "احترافي",
      targetAudience: "مشترو العقارات",
    });
    assert.equal(result.content, "حزمة محتوى");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("image analysis sends the selected analysis type without leaving the local runtime", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: unknown = null;

  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body ?? "{}"));
    return new Response(
      JSON.stringify({
        analysis: "الإعلان واضح ويحتاج CTA أقوى.",
        modelUsed: "llama3.2-vision",
        provider: "ollama-local",
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  try {
    const result = await analyzeLocalImage({
      imageBase64: "data:image/png;base64,AAAA",
      analysisType: "ad_critique",
      prompt: "راجع CTA",
    });
    assert.equal(result.provider, "ollama-local");
    assert.deepEqual(requestBody, {
      imageBase64: "data:image/png;base64,AAAA",
      analysisType: "ad_critique",
      prompt: "راجع CTA",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("local runtime health rejects malformed responses", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        status: "ok",
        service: 42,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );

  try {
    await assert.rejects(
      () => fetchLocalRuntimeHealth(),
      /Invalid local runtime health response/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("local chat rejects malformed model responses", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        text: "reply",
        provider: "ollama-local",
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );

  try {
    await assert.rejects(
      () =>
        sendLocalChat([{ role: "user", text: "hello" }]),
      /Invalid local runtime chat response/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("desktop runtime client rejects non-loopback endpoints", async () => {
  await assert.rejects(
    () => fetchLocalRuntimeHealth("https://remote.example"),
    /must remain on the local machine/,
  );
});
