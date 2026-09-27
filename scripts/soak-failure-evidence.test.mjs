import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const outputDir = mkdtempSync(join(tmpdir(), "orbit-soak-evidence-"));

try {
  try {
    execFileSync(
      process.platform === "win32" ? "pnpm.cmd" : "pnpm",
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
    throw new Error("soak mismatch test unexpectedly succeeded");
  } catch (error) {
    assert.equal(error?.status, 1);
  }

  const summaryPath = join(outputDir, "soak-summary.json");
  const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
  assert.equal(summary.ok, false);
  assert.equal(summary.gitSha, "actual-sha");
  assert.match(summary.errorMessage, /source SHA mismatch/);

  console.log("soak_failure_evidence_test=PASS");
} finally {
  rmSync(outputDir, { recursive: true, force: true });
}
