export const DEFAULT_RUNTIME_URL = "http://127.0.0.1:3000";

export interface RuntimeHealth {
  readonly status: "ok" | "degraded" | "offline";
  readonly service: string;
  readonly provider?: string;
  readonly model?: string;
  readonly visionConfigured?: boolean;
}

export interface RuntimeChatMessage {
  readonly role: "user" | "assistant";
  readonly text: string;
}

export interface RuntimeChatResponse {
  readonly text: string;
  readonly modelUsed: string;
  readonly provider: string;
}

export interface RuntimeContentRequest {
  readonly topic: string;
  readonly dialect: string;
  readonly tone: string;
  readonly targetAudience: string;
}

export interface RuntimeContentResponse {
  readonly content: string;
  readonly modelUsed: string;
  readonly provider: string;
}

export interface RuntimeImageAnalysisRequest {
  readonly imageBase64: string;
  readonly analysisType:
    "ad_critique" | "ocr_copy" | "platform_fit" | "comprehensive";
  readonly prompt?: string;
}

export interface RuntimeImageAnalysisResponse {
  readonly analysis: string;
  readonly modelUsed: string;
  readonly provider: string;
}

export async function fetchLocalRuntimeHealth(
  baseUrl = DEFAULT_RUNTIME_URL,
): Promise<RuntimeHealth> {
  const payload = await requestJson<unknown>(baseUrl, "/api/health");
  if (!isRuntimeHealth(payload))
    throw new Error("Invalid local runtime health response");
  return payload;
}

export async function sendLocalChat(
  messages: readonly RuntimeChatMessage[],
  roleId = "marketing_strategist",
  profile = "balanced",
  baseUrl = DEFAULT_RUNTIME_URL,
): Promise<RuntimeChatResponse> {
  if (messages.length === 0 || messages.length > 100) {
    throw new RangeError("Chat must contain between 1 and 100 messages");
  }

  const cleanMessages = messages
    .map((message) => ({
      role: message.role,
      text: message.text.trim().slice(0, 20_000),
    }))
    .filter((message) => message.text.length > 0);

  if (cleanMessages.length === 0) {
    throw new Error("Chat message list is empty");
  }

  const payload = await requestJson<unknown>(baseUrl, "/api/chat", {
    method: "POST",
    body: JSON.stringify({
      messages: cleanMessages,
      roleId,
      profile,
    }),
  });
  if (!isRuntimeChatResponse(payload))
    throw new Error("Invalid local runtime chat response");
  return payload;
}

export async function generateLocalContent(
  request: RuntimeContentRequest,
  baseUrl = DEFAULT_RUNTIME_URL,
): Promise<RuntimeContentResponse> {
  if (!request.topic.trim()) {
    throw new Error("Content topic is required");
  }

  const payload = await requestJson<unknown>(baseUrl, "/api/generate-content", {
    method: "POST",
    body: JSON.stringify({
      topic: request.topic.trim().slice(0, 2_000),
      dialect: request.dialect.trim().slice(0, 200),
      tone: request.tone.trim().slice(0, 200),
      targetAudience: request.targetAudience.trim().slice(0, 500),
    }),
  });
  if (!isRuntimeContentResponse(payload))
    throw new Error("Invalid local runtime content response");
  return payload;
}

export async function analyzeLocalImage(
  request: RuntimeImageAnalysisRequest,
  baseUrl = DEFAULT_RUNTIME_URL,
): Promise<RuntimeImageAnalysisResponse> {
  if (!request.imageBase64.trim()) {
    throw new Error("Image data is required");
  }

  const payload = await requestJson<unknown>(baseUrl, "/api/analyze-image", {
    method: "POST",
    body: JSON.stringify({
      imageBase64: request.imageBase64,
      analysisType: request.analysisType,
      ...(request.prompt?.trim()
        ? { prompt: request.prompt.trim().slice(0, 4_000) }
        : {}),
    }),
  });
  if (!isRuntimeImageAnalysisResponse(payload))
    throw new Error("Invalid local runtime image-analysis response");
  return payload;
}

async function requestJson<T>(
  baseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const normalized = normalizeRuntimeUrl(baseUrl);
  let response: Response;

  try {
    response = await fetch(normalized + path, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
      signal: init?.signal ?? AbortSignal.timeout(120_000),
    });
  } catch (error: unknown) {
    throw new Error(
      error instanceof Error
        ? `Local runtime request failed: ${error.message}`
        : "Local runtime request failed",
    );
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      isRecord(body) && typeof body.error === "string"
        ? body.error
        : `Runtime returned HTTP ${response.status}`;
    throw new Error(message);
  }

  if (!isRecord(body)) {
    throw new Error("Runtime returned an invalid JSON response");
  }

  return body as T;
}

function normalizeRuntimeUrl(value: string): string {
  const normalized = value.trim().replace(/\/$/, "");
  const url = new URL(normalized);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Runtime URL must use http or https");
  }

  if (url.username || url.password) {
    throw new Error("Runtime URL must not contain embedded credentials");
  }

  if (
    url.hostname !== "127.0.0.1" &&
    url.hostname !== "localhost" &&
    url.hostname !== "::1"
  ) {
    throw new Error("Desktop AI runtime must remain on the local machine");
  }

  return url.toString().replace(/\/$/, "");
}

function isRuntimeHealth(value: unknown): value is RuntimeHealth {
  if (!isRecord(value)) return false;
  return (
    (value.status === "ok" ||
      value.status === "degraded" ||
      value.status === "offline") &&
    typeof value.service === "string" &&
    (value.provider === undefined || typeof value.provider === "string") &&
    (value.model === undefined || typeof value.model === "string") &&
    (value.visionConfigured === undefined ||
      typeof value.visionConfigured === "boolean")
  );
}

function isRuntimeChatResponse(value: unknown): value is RuntimeChatResponse {
  if (!isRecord(value)) return false;
  return (
    typeof value.text === "string" &&
    typeof value.modelUsed === "string" &&
    typeof value.provider === "string"
  );
}

function isRuntimeContentResponse(
  value: unknown,
): value is RuntimeContentResponse {
  if (!isRecord(value)) return false;
  return (
    typeof value.content === "string" &&
    typeof value.modelUsed === "string" &&
    typeof value.provider === "string"
  );
}

function isRuntimeImageAnalysisResponse(
  value: unknown,
): value is RuntimeImageAnalysisResponse {
  if (!isRecord(value)) return false;
  return (
    typeof value.analysis === "string" &&
    typeof value.modelUsed === "string" &&
    typeof value.provider === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
