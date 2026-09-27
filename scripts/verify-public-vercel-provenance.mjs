const base = (
  process.env.ORBIT_LIVE_URL ?? "https://orbit-marketing-os.vercel.app"
).replace(/\/$/, "");
const expected = process.env.ORBIT_EXPECTED_RELEASE_SHA?.trim();
if (!expected) throw new Error("ORBIT_EXPECTED_RELEASE_SHA is required");

async function get(pathname) {
  return fetch(base + pathname, {
    headers: { accept: "application/json,text/html" },
    signal: AbortSignal.timeout(15_000),
  });
}

let last = "";
for (let attempt = 1; attempt <= 12; attempt += 1) {
  try {
    const health = await get("/api/health.json");
    const release = await get("/api/release.json");
    if (health.ok && release.ok) {
      const healthBody = await health.json();
      const releaseBody = await release.json();
      if (
        healthBody?.releaseSha === expected &&
        releaseBody?.releaseSha === expected &&
        releaseBody?.releaseProvenance?.declaredByEnvironment === true
      ) {
        const home = await get("/");
        if (!home.ok) {
          throw new Error("production home HTTP " + home.status);
        }
        const html = await home.text();
        if (!html.includes(`data-release-sha="${expected}"`)) {
          throw new Error("production HTML release SHA mismatch");
        }
        console.log(
          JSON.stringify({
            status: "PASS",
            origin: base,
            expectedReleaseSha: expected,
            verifiedPaths: ["/", "/api/health.json", "/api/release.json"],
            attempt,
          }),
        );
        process.exit(0);
      }
      last = JSON.stringify({ healthBody, releaseBody });
    } else {
      last = `health=${health.status} release=${release.status}`;
    }
  } catch (error) {
    last = error instanceof Error ? error.message : String(error);
  }
  await new Promise((resolve) => setTimeout(resolve, 15_000));
}

throw new Error(
  `Vercel production did not expose the expected release SHA within 3 minutes. expected=${expected} last=${last}`,
);
