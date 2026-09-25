import { describe, expect, it } from "vitest";
import {
  analyzeLocalImage,
  DEFAULT_RUNTIME_URL,
  fetchLocalRuntimeHealth,
  generateLocalContent,
  sendLocalChat,
} from "../src/lib/runtimeClient.ts";

describe("desktop runtime client", () => {
  it("local runtime health uses the loopback endpoint", async () => {
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
      expect(receivedUrl).toBe(DEFAULT_RUNTIME_URL + "/api/health");
      expect(health.model).toBe("llama3.2:3b");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("local chat sends typed messages and returns the model response", async () => {
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
      expect(result.text).toBe("اقتراحات الحملة");
      expect(requestBody).toEqual({
        messages: [{ role: "user", text: "اقترح زوايا للحملة" }],
        roleId: "marketing_strategist",
        profile: "balanced",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("content generation validates required topic and serializes the payload", async () => {
    await expect(
      generateLocalContent({
        topic: "",
        dialect: "فصحى مبسطة",
        tone: "احترافي",
        targetAudience: "الجمهور العام",
      }),
    ).rejects.toThrow("topic is required");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<
        string,
        unknown
      >;
      expect(body.topic).toBe("حملة جديدة");
      expect(body.targetAudience).toBe("مشترو العقارات");
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
      expect(result.content).toBe("حزمة محتوى");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("image analysis sends the selected analysis type without leaving the local runtime", async () => {
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
      expect(result.provider).toBe("ollama-local");
      expect(requestBody).toEqual({
        imageBase64: "data:image/png;base64,AAAA",
        analysisType: "ad_critique",
        prompt: "راجع CTA",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("local runtime health rejects malformed responses", async () => {
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
      await expect(fetchLocalRuntimeHealth()).rejects.toThrow(
        "Invalid local runtime health response",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("local chat rejects malformed model responses", async () => {
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
      await expect(
        sendLocalChat([{ role: "user", text: "hello" }]),
      ).rejects.toThrow("Invalid local runtime chat response");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("desktop runtime client rejects non-loopback endpoints", async () => {
    await expect(
      fetchLocalRuntimeHealth("https://remote.example"),
    ).rejects.toThrow("must remain on the local machine");
  });
});
