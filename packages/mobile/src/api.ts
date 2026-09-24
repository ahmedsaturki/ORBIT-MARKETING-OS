export interface HealthResponse {
  readonly status: "ok";
  readonly service: string;
  readonly hasApiKey: boolean;
  readonly time: string;
}

export type HealthResult =
  | { readonly ok: true; readonly health: HealthResponse; readonly latencyMs: number }
  | { readonly ok: false; readonly error: string };

export const DEFAULT_SERVER_URL = "http://localhost:3000";
export const REQUEST_TIMEOUT_MS = 5000;

export async function fetchHealth(
  baseUrl: string,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<HealthResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `${baseUrl.replace(/\/+$/, "")}/api/health`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const health = (await res.json()) as HealthResponse;
    if (health.status !== "ok") {
      return { ok: false, error: `unexpected status: ${String(health.status)}` };
    }
    return { ok: true, health, latencyMs: Date.now() - started };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}
