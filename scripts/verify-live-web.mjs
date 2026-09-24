const url = process.env.ORBIT_LIVE_URL?.trim();
if (!url) throw new Error("ORBIT_LIVE_URL is required");

const parsed = new URL(url);
if (parsed.protocol !== "https:") throw new Error("Live ORBIT URL must use HTTPS");

async function get(pathname, accept = "text/html,application/xhtml+xml") {
  const response = await fetch(new URL(pathname, parsed), {
    headers: { accept },
    signal: AbortSignal.timeout(15_000),
  });
  return response;
}

const home = await get("/");
if (!home.ok) throw new Error("Live ORBIT home returned HTTP " + home.status);

const body = await home.text();
for (const fragment of [
  "ORBIT Marketing OS",
  "مركز تشغيل تسويقك",
]) {
  if (!body.includes(fragment)) {
    throw new Error("Live ORBIT home is missing expected rebuild marker: " + fragment);
  }
}

if (body.includes("Orbit Marketing OS - منصة تشغيل وتسويق وأتمتة شاملة")) {
  throw new Error("Live ORBIT page is still serving the legacy main/Vite surface");
}

for (const pathname of ["/pricing/", "/legal/privacy/", "/legal/terms/", "/legal/refunds/", "/legal/eula/"]) {
  const response = await get(pathname);
  if (!response.ok) {
    throw new Error(`Live ORBIT route ${pathname} returned HTTP ${response.status}`);
  }
}

const manifest = await get("/manifest.json", "application/manifest+json,application/json");
if (!manifest.ok) throw new Error("Live ORBIT manifest returned HTTP " + manifest.status);
const manifestBody = await manifest.json();
if (typeof manifestBody?.name !== "string" || !/ORBIT/i.test(manifestBody.name)) {
  throw new Error("Live ORBIT manifest branding mismatch");
}
if (manifestBody?.start_url !== "/") throw new Error("Live ORBIT manifest start_url mismatch");
if (manifestBody?.display !== "standalone") throw new Error("Live ORBIT manifest display mismatch");

const serviceWorker = await get("/sw.js", "text/javascript,*/*");
if (!serviceWorker.ok) throw new Error("Live ORBIT service worker returned HTTP " + serviceWorker.status);
const swBody = await serviceWorker.text();
if (!swBody.includes("addEventListener")) throw new Error("Live ORBIT service worker is invalid");

for (const [header, expected] of [
  ["x-content-type-options", "nosniff"],
  ["referrer-policy", "strict-origin-when-cross-origin"],
  ["permissions-policy", "camera=(), microphone=(), geolocation=()"],
  ["cross-origin-opener-policy", "same-origin"],
  ["cross-origin-resource-policy", "same-origin"],
]) {
  const value = home.headers.get(header);
  if (value !== expected) {
    throw new Error(`Live ORBIT security header ${header} mismatch: ${value ?? "missing"}`);
  }
}

const missing = await get("/this-path-does-not-exist/");
if (missing.status !== 404) {
  throw new Error("Live ORBIT unknown route must return HTTP 404, got " + missing.status);
}

console.log("Live ORBIT web verification passed:", parsed.origin);
