#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const observationPath = join(root, "release", "OBSERVED_PRODUCTION.json");
const base = (
  process.env.ORBIT_LIVE_URL ?? "https://orbit-marketing-os.vercel.app"
).replace(/\/$/, "");

const observation = JSON.parse(await readFile(observationPath, "utf8"));
const deployment = observation?.deployment;
const release = observation?.release;

function fail(message) {
  console.error("production-observation=FAIL");
  console.error(message);
  process.exit(1);
}

if (
  observation?.schemaVersion !== 1 ||
  observation?.environment !== "production" ||
  typeof observation?.observedAt !== "string" ||
  observation?.releaseTruth?.commercialProductionProven !== false ||
  !observation?.runtimeErrors ||
  typeof observation.runtimeErrors.window !== "string" ||
  typeof observation.runtimeErrors.count !== "number" ||
  observation.runtimeErrors.verifiedBy !== "owner" ||
  !deployment ||
  !/^dpl_[A-Za-z0-9_-]+$/.test(deployment.id) ||
  deployment.state !== "READY" ||
  deployment.target !== "production" ||
  !/^[0-9a-f]{40}$/i.test(deployment.gitCommitSha) ||
  deployment.gitCommitRef !== "main" ||
  !release ||
  !/^\d+\.\d+\.\d+$/.test(release.version) ||
  release.releaseSha !== deployment.gitCommitSha ||
  release.provenanceSource !== "VERCEL_GIT_COMMIT_SHA"
) {
  fail("Invalid production observation schema");
}

const expectedPaths = ["/", "/api/health.json", "/api/release.json"];
const actualPaths = (observation.endpointChecks ?? []).map(
  (check) => check?.path,
);
if (
  !Array.isArray(observation.endpointChecks) ||
  observation.endpointChecks.length !== expectedPaths.length ||
  new Set(actualPaths).size !== expectedPaths.length ||
  !expectedPaths.every((path) => actualPaths.includes(path))
) {
  fail(
    "Endpoint checks must contain exactly /, /api/health.json, and /api/release.json",
  );
}

for (const check of observation.endpointChecks) {
  if (
    !check?.path ||
    check.httpStatus !== 200 ||
    typeof check.assertion !== "string"
  ) {
    fail("Invalid endpoint check contract");
  }
}

async function get(pathname) {
  return fetch(base + pathname, {
    headers: { accept: "application/json,text/html" },
    signal: AbortSignal.timeout(15_000),
  });
}

const health = await get("/api/health.json");
const releaseResponse = await get("/api/release.json");
const home = await get("/");

if (!health.ok || !releaseResponse.ok || !home.ok) {
  fail(
    `Production endpoint failure: health=${health.status} release=${releaseResponse.status} home=${home.status}`,
  );
}

const healthBody = await health.json();
const releaseBody = await releaseResponse.json();
const html = await home.text();

if (
  healthBody?.version !== release.version ||
  releaseBody?.version !== release.version ||
  healthBody?.releaseSha !== release.releaseSha ||
  releaseBody?.releaseSha !== release.releaseSha ||
  healthBody?.provenanceSource !== release.provenanceSource ||
  releaseBody?.releaseProvenance?.source !== release.provenanceSource ||
  releaseBody?.releaseProvenance?.declaredByEnvironment !== true ||
  !html.includes(`data-release-sha="${release.releaseSha}"`)
) {
  fail(
    "Live production identity does not match release/OBSERVED_PRODUCTION.json",
  );
}

console.log(
  JSON.stringify({
    status: "PASS",
    origin: base,
    deploymentId: deployment.id,
    releaseVersion: release.version,
    releaseSha: release.releaseSha,
    provenanceSource: release.provenanceSource,
    // runtimeErrors is owner-attested; no endpoint here exposes error telemetry,
    // so this run does NOT verify it. See .omp/RULES.md — never treat a
    // reachable deployment as external production proof.
    runtimeErrorsMachineVerified: false,
    runtimeErrorsVerifiedBy: observation.runtimeErrors.verifiedBy,
    verifiedPaths: ["/", "/api/health.json", "/api/release.json"],
  }),
);
