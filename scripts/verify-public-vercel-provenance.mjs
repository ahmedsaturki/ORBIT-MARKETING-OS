import { sanitizeOrigin, sanitizeText } from "./child-env.mjs";

const base = sanitizeOrigin(
  process.env.ORBIT_LIVE_URL ?? "https://orbit-marketing-os.vercel.app",
);

const expected = process.env.ORBIT_EXPECTED_RELEASE_SHA?.trim();
const expectedVersion = process.env.ORBIT_EXPECTED_RELEASE_VERSION ?? "1.0.0";

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
      const allowedSources = new Set([
        "NEXT_PUBLIC_ORBIT_RELEASE_SHA",
        "VERCEL_GIT_COMMIT_SHA",
      ]);
      if (
        healthBody?.version === expectedVersion &&
        releaseBody?.version === expectedVersion &&
        healthBody?.releaseSha === expected &&
        releaseBody?.releaseSha === expected &&
        releaseBody?.releaseProvenance?.declaredByEnvironment === true &&
        allowedSources.has(healthBody?.provenanceSource) &&
        allowedSources.has(releaseBody?.releaseProvenance?.source) &&
        healthBody.provenanceSource === releaseBody.releaseProvenance.source
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
            expectedReleaseVersion: expectedVersion,
            verifiedVersion: healthBody?.version,
            verifiedPaths: ["/", "/api/health.json", "/api/release.json"],
            attempt,
          }),
        );
        process.exit(0);
      }
      last = sanitizeText(JSON.stringify({ healthBody, releaseBody }));
    } else {
      last = sanitizeText(`health=${health.status} release=${release.status}`);
    }
  } catch (error) {
    last = sanitizeText(error instanceof Error ? error.message : String(error));
  }
  await new Promise((resolve) => setTimeout(resolve, 15_000));
}

throw new Error(
  `Vercel production did not expose the expected release SHA within 3 minutes. expected=${expected} last=${last}`,
);
