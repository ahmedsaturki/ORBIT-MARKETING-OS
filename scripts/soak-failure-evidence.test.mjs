import assert from "node:assert/strict";
import { spawnPnpm } from "./lib/spawn-pnpm.mjs";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const outputDir = mkdtempSync(join(tmpdir(), "orbit-soak-evidence-"));

try {
  const result = spawnPnpm(
    ["exec", "tsx", "scripts/soak.ts", "--minutes", "1"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        GITHUB_SHA: "actual-sha",
        ORBIT_EXPECTED_RELEASE_SHA: "different-sha",
        ORBIT_SOAK_LOG_DIR: outputDir,
      },
    },
  );
  assert.notEqual(
    result.status,
    0,
    "soak source-SHA mismatch must fail closed with a non-zero exit",
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
