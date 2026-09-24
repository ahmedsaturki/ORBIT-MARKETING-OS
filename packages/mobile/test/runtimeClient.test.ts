import assert from "node:assert/strict";
import test from "node:test";
import { fetchRuntimeHealth } from "../src/services/runtimeClient.ts";

test("runtime client validates health payload and sends bearer token", async () => {
  const originalFetch = globalThis.fetch;
  let receivedUrl = "";
  let receivedAuthorization = "";

  globalThis.fetch = async (input, init) => {
    receivedUrl = String(input);
    const headers = new Headers(init?.headers);
    receivedAuthorization = headers.get("authorization") ?? "";
    return new Response(
      JSON.stringify({
        status: "degraded",
        service: "Orbit Marketing OS Local Runtime",
        provider: "ollama-local",
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  try {
    const health = await fetchRuntimeHealth("http://127.0.0.1:3000/", "secret-token");
    assert.equal(health.status, "degraded");
    assert.equal(health.provider, "ollama-local");
    assert.equal(receivedUrl, "http://127.0.0.1:3000/api/health");
    assert.equal(receivedAuthorization, "Bearer secret-token");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("runtime client rejects embedded URL credentials", async () => {
  await assert.rejects(
    () => fetchRuntimeHealth("http://user:password@127.0.0.1:3000"),
    /embedded credentials/,
  );
});

test("runtime client rejects unsupported URL protocols", async () => {
  await assert.rejects(
    () => fetchRuntimeHealth("file:///tmp/orbit"),
    /http or https/,
  );
});

test("runtime client rejects malformed health payloads", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        status: "degraded",
        service: 123,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );

  try {
    await assert.rejects(
      () => fetchRuntimeHealth("http://127.0.0.1:3000"),
      /Invalid runtime health response/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
