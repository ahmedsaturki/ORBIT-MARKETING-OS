/**
 * Contract for scripts/verify-live-production-observation.mjs, which
 * .github/workflows/ci.yml runs on every pull request.
 *
 * Two guards matter here and neither had coverage:
 *
 *  1. runtimeErrors was asserted against the very file that declared it. The
 *     script fetches /api/health.json, /api/release.json and / -- none of which
 *     expose error telemetry -- so the check could never fail for a real reason.
 *     It now requires runtimeErrors.verifiedBy === "owner" and reports
 *     runtimeErrorsMachineVerified: false, so a reader cannot mistake an
 *     owner-attested figure for a machine-verified one.
 *
 *  2. The endpoint assertions must actually fire. A verifier that prints PASS
 *     without checking anything is the failure mode this audit keeps finding, so
 *     every guard is proved to reject, not merely to accept.
 *
 * A local HTTP server stands in for the deployment via ORBIT_LIVE_URL, so this
 * test never requests production. The child is spawned asynchronously on
 * purpose: spawnSync would block this process's event loop, and an in-process
 * server cannot accept a connection while its own event loop is blocked.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const script = resolve(here, "verify-live-production-observation.mjs");
const observation = JSON.parse(
  readFileSync(
    resolve(here, "..", "release", "OBSERVED_PRODUCTION.json"),
    "utf8",
  ),
);

const SHA = observation.release.releaseSha;
// The served HTML is pinned to this SHA rather than derived from the document
// under test. A fixture derived from the document always agrees with it, which
// would make the drift assertion below vacuous.
const PINNED_SHA = SHA;

/**
 * Serve the three endpoints the verifier fetches, from the supplied document,
 * so a mutated observation also produces mutated responses.
 */
function serve(doc) {
  const server = createServer((req, res) => {
    const send = (body, type = "application/json") => {
      res.writeHead(200, { "content-type": type });
      res.end(typeof body === "string" ? body : JSON.stringify(body));
    };
    if (req.url === "/api/health.json") {
      send({
        status: "ok",
        version: doc.release.version,
        releaseSha: doc.release.releaseSha,
        provenanceSource: doc.release.provenanceSource,
      });
    } else if (req.url === "/api/release.json") {
      send({
        version: doc.release.version,
        releaseSha: doc.release.releaseSha,
        releaseProvenance: {
          declaredByEnvironment: true,
          source: doc.release.provenanceSource,
        },
      });
    } else if (req.url === "/") {
      send(
        `<!doctype html><body data-release-sha="${PINNED_SHA}">`,
        "text/html",
      );
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  return new Promise((r) => server.listen(0, "127.0.0.1", () => r(server)));
}

function execNode(args, env, timeoutMs = 60_000) {
  return new Promise((settle) => {
    const child = spawn(process.execPath, args, { env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d;
    });
    child.stderr.on("data", (d) => {
      stderr += d;
    });
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.on("close", (code) => {
      clearTimeout(timer);
      settle({ status: code, output: stdout + stderr });
    });
  });
}

async function runAgainst(doc) {
  const dir = mkdtempSync(join(tmpdir(), "orbit-prod-obs-"));
  const fixture = join(dir, "observation.json");
  writeFileSync(fixture, JSON.stringify(doc, null, 2));
  const server = await serve(doc);
  const { port } = server.address();
  try {
    const { status, output } = await execNode([script], {
      ...process.env,
      ORBIT_OBSERVATION_FILE: fixture,
      ORBIT_LIVE_URL: `http://127.0.0.1:${port}`,
    });
    let json = null;
    try {
      json = JSON.parse(output.trim().split("\n").pop());
    } catch {
      /* rejection output is not JSON, which is expected */
    }
    return { status, output, json };
  } finally {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

const clone = () => JSON.parse(JSON.stringify(observation));

// The happy path must pass, and must say out loud that runtime errors are not
// machine-verified. A silent PASS here would reintroduce the original defect.
{
  const { status, json } = await runAgainst(clone());
  assert.equal(status, 0, "a well-formed observation must pass");
  assert.equal(json.status, "PASS");
  assert.equal(
    json.runtimeErrorsMachineVerified,
    false,
    "the verifier must report that it does not verify runtimeErrors",
  );
  assert.equal(json.runtimeErrorsVerifiedBy, "owner");
}

// runtimeErrors provenance: every rejection must exit non-zero and say why.
for (const [label, mutate] of [
  ["verifiedBy removed", (d) => delete d.runtimeErrors.verifiedBy],
  ["verifiedBy: 'agent'", (d) => (d.runtimeErrors.verifiedBy = "agent")],
  ["verifiedBy: 'ci'", (d) => (d.runtimeErrors.verifiedBy = "ci")],
  ["count is a string", (d) => (d.runtimeErrors.count = "0")],
  ["runtimeErrors absent", (d) => delete d.runtimeErrors],
]) {
  const doc = clone();
  mutate(doc);
  const { status, output } = await runAgainst(doc);
  assert.equal(status, 1, `${label}: must be rejected`);
  assert.match(
    output,
    /Invalid production observation schema/,
    `${label}: must say why`,
  );
}

// A verifier that only ever accepts is the defect class this audit keeps
// finding, so the deployment-side assertions must be shown to fire too.
for (const [label, mutate] of [
  ["deployment not READY", (d) => (d.deployment.state = "BUILDING")],
  ["gitCommitRef not main", (d) => (d.deployment.gitCommitRef = "feature")],
  [
    "releaseSha diverges from deployment",
    (d) => (d.release.releaseSha = "a".repeat(40)),
  ],
  [
    "provenanceSource not Vercel",
    (d) => (d.release.provenanceSource = "MANUAL"),
  ],
  [
    "commercialProductionProven flipped true",
    (d) => (d.releaseTruth.commercialProductionProven = true),
  ],
  ["a required endpoint check removed", (d) => d.endpointChecks.pop()],
]) {
  const doc = clone();
  mutate(doc);
  const { status } = await runAgainst(doc);
  assert.equal(status, 1, `${label}: must be rejected`);
}

// The home page's SHA is the one thing that could silently drift, so prove the
// comparison is live rather than assumed: a self-consistent but fabricated pair
// must still fail against the HTML the server actually serves.
{
  const doc = clone();
  doc.release.releaseSha = "b".repeat(40);
  doc.deployment.gitCommitSha = "b".repeat(40);
  const { status } = await runAgainst(doc);
  assert.equal(
    status,
    1,
    "a self-consistent but fabricated SHA must still fail against the served HTML",
  );
}

assert.notEqual(SHA, "b".repeat(40), "fixture sanity");
console.log("production-observation-contract=PASS");
