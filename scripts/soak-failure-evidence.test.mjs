import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runTsx } from "./run-tsx.mjs";

const outputDir = mkdtempSync(join(tmpdir(), "orbit-soak-evidence-"));

try {
  // spawnSync reports a non-zero exit through `status` rather than throwing.
  const result = runTsx(["scripts/soak.ts", "--minutes", "1"], {
    env: {
      ...process.env,
      GITHUB_SHA: "actual-sha",
      ORBIT_EXPECTED_RELEASE_SHA: "different-sha",
      ORBIT_SOAK_LOG_DIR: outputDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  assert.equal(
    result.error,
    undefined,
    `soak failed to launch: ${result.error?.message}`,
  );
  assert.equal(result.status, 1, "source SHA mismatch must exit 1");

  const summaryPath = join(outputDir, "soak-summary.json");
  const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
  assert.equal(summary.ok, false);
  assert.equal(summary.gitSha, "actual-sha");
  assert.match(summary.errorMessage, /source SHA mismatch/);

  console.log("soak_failure_evidence_test=PASS");
} finally {
  rmSync(outputDir, { recursive: true, force: true });
}

// A soak must not attest to a duration it did not run. Requesting more
// minutes than the loop can complete must be reported as a short run.
const shortRunDir = mkdtempSync(join(tmpdir(), "orbit-soak-short-"));

try {
  const shortResult = runTsx(
    ["scripts/soak.ts", "--hours", "24", "--port", "0", "--max-cycles", "1"],
    {
      env: { ...process.env, ORBIT_SOAK_LOG_DIR: shortRunDir },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  assert.equal(
    shortResult.error,
    undefined,
    `short soak failed to launch: ${shortResult.error?.message}`,
  );
  assert.equal(
    shortResult.status,
    1,
    "a soak that cannot reach its deadline must not exit 0",
  );

  const shortSummary = JSON.parse(
    readFileSync(join(shortRunDir, "soak-summary.json"), "utf8"),
  );
  assert.equal(shortSummary.requestedMinutes, 1440);
  assert.ok(
    shortSummary.elapsedMinutes < 1440,
    `elapsed ${shortSummary.elapsedMinutes} must be under the requested 1440`,
  );
  // The run may also fail for an unrelated reason; the duration guarantee
  // is only proven when the short-run guard itself is what refused it.
  assert.ok(
    shortSummary.failures.some((entry) =>
      /ended after [\d.]+ min of a requested 1440 min/.test(entry),
    ),
    `expected a short-run failure, got: ${JSON.stringify(shortSummary.failures)}`,
  );
  assert.equal(shortSummary.ok, false);
} finally {
  rmSync(shortRunDir, { recursive: true, force: true });
}
