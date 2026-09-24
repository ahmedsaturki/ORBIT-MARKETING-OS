export interface RuntimeHealth {
  readonly status: "ok" | "degraded" | "offline";
  readonly service: string;
  readonly provider?: string;
  readonly model?: string;
  readonly visionConfigured?: boolean;
  readonly host?: string;
}

export async function fetchRuntimeHealth(
  baseUrl: string,
  authToken = "",
): Promise<RuntimeHealth> {
  const normalized = baseUrl.replace(/\/$/, "");
  const token = authToken.trim();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(normalized + "/api/health", {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error("Runtime health request failed: " + response.status);
  }

  const payload: unknown = await response.json();
  if (!isRuntimeHealth(payload)) throw new Error("Invalid runtime health response");
  return payload;
}

function isRuntimeHealth(value: unknown): value is RuntimeHealth {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    (record.status === "ok" || record.status === "degraded" || record.status === "offline") &&
    typeof record.service === "string"
  );
}
