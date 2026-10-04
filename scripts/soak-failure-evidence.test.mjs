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

  assert.equal(result.error, undefined, `soak failed to launch: ${result.error?.message}`);
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
