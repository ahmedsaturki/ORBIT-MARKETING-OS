/**
 * Strip CR/LF and other control characters from externally sourced values
 * before they reach logs or thrown errors (SonarCloud jssecurity:S5145).
 * Verification semantics always use the unsanitized originals.
 */
function sanitizeForLog(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/gu, " ")
    .slice(0, 512);
}

/**
 * The fetch target is always one of these literal origins. The environment
 * may only *select* among them by exact string match; it can never contribute
 * characters to a URL that is requested. That makes the SSRF surface
 * unreachable by construction rather than by validation order, and keeps the
 * tainted env value out of the fetch call entirely (SonarCloud
 * jssecurity:S5145).
 */
const CANONICAL_ORIGIN = "https://orbit-marketing-os.vercel.app";
const PREVIEW_ORIGIN = "https://orbit-marketing-os-git-main-team.vercel.app";
const ALLOWED_ORIGINS = [CANONICAL_ORIGIN, PREVIEW_ORIGIN];

function resolveLiveOrigin() {
  const raw = (process.env.ORBIT_LIVE_URL ?? CANONICAL_ORIGIN).trim();
  // Exact match against a fixed list: no prefix, suffix, or host-parsing rules,
  // so `...vercel.app.evil.test` and userinfo tricks cannot match.
  const match = ALLOWED_ORIGINS.find((origin) => origin === raw);
  if (!match) {
    throw new Error(
      `ORBIT_LIVE_URL must be exactly one of the allowed deployment origins, got: ${sanitizeForLog(raw)}`,
    );
  }
  return match;
}

const base = resolveLiveOrigin();
const expected = process.env.ORBIT_EXPECTED_RELEASE_SHA?.trim();
const expectedVersion = process.env.ORBIT_EXPECTED_RELEASE_VERSION ?? "1.0.0";

/** Endpoints this script is allowed to read. Literal paths, never caller data. */
const ENDPOINTS = {
  home: "/",
  health: "/api/health.json",
  release: "/api/release.json",
};

async function get(pathname) {
  return fetch(base + pathname, {
    headers: { accept: "application/json,text/html" },
    signal: AbortSignal.timeout(15_000),
    redirect: "error",
  });
}

let last = "";
for (let attempt = 1; attempt <= 12; attempt += 1) {
  try {
    const health = await get(ENDPOINTS.health);
    const release = await get(ENDPOINTS.release);
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
        const home = await get(ENDPOINTS.home);
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
            origin: sanitizeForLog(base),
            expectedReleaseSha: sanitizeForLog(expected),
            expectedReleaseVersion: expectedVersion,
            verifiedVersion: healthBody?.version,
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
  `Vercel production did not expose the expected release SHA within 3 minutes. expected=${sanitizeForLog(expected)} last=${sanitizeForLog(last)}`,
);
