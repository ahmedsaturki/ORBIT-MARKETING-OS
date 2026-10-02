import { runPackageManager } from "./lib/spawn.mjs";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const outputDir = mkdtempSync(join(tmpdir(), "orbit-soak-evidence-"));

try {
  const mismatch = runPackageManager(
    ["exec", "tsx", "scripts/soak.ts", "--minutes", "1"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_SHA: "actual-sha",
        ORBIT_EXPECTED_RELEASE_SHA: "different-sha",
        ORBIT_SOAK_LOG_DIR: outputDir,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  assert.equal(
    mismatch.status,
    1,
    `expected soak SHA-mismatch fail-closed exit 1, got ${mismatch.status}\nstdout=${mismatch.stdout}\nstderr=${mismatch.stderr}`,
  );

  const summaryPath = join(outputDir, "soak-summary.json");
  const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
  assert.equal(summary.ok, false);
  assert.equal(summary.gitSha, "actual-sha");
  assert.match(summary.errorMessage, /source SHA mismatch/);

  console.log("soak_failure_evidence_test=PASS");
} finally {
  rmSync(outputDir, { recursive: true, force: true });
}
