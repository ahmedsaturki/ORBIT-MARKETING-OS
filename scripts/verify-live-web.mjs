const url = process.env.ORBIT_LIVE_URL?.trim();
if (!url) throw new Error("ORBIT_LIVE_URL is required");

const parsed = new URL(url);
if (parsed.protocol !== "https:") throw new Error("Live ORBIT URL must use HTTPS");

const response = await fetch(parsed, {
  headers: { "accept": "text/html,application/xhtml+xml" },
  signal: AbortSignal.timeout(15_000),
});
if (!response.ok) throw new Error("Live ORBIT page returned HTTP " + response.status);

const body = await response.text();
const required = [
  "ORBIT Marketing OS",
  "مركز تشغيل تسويقك",
  "الخطط والأسعار",
];
for (const fragment of required) {
  if (!body.includes(fragment)) throw new Error("Live ORBIT page is missing expected rebuild marker: " + fragment);
}

if (body.includes("Orbit Marketing OS - منصة تشغيل وتسويق وأتمتة شاملة")) {
  throw new Error("Live ORBIT page is still serving the legacy main/Vite surface");
}

console.log("Live ORBIT web verification passed:", parsed.origin);
