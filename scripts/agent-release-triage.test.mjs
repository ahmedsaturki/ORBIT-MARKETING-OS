import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

test("agent release triage summary counts partition the release-critical total", () => {
  const stdout = execFileSync(
    process.execPath,
    [join(repoRoot, "scripts", "agent-release-triage.mjs")],
    { cwd: repoRoot, encoding: "utf8" },
  );
  const payload = JSON.parse(stdout);
  const summary = payload.summary;
  assert.equal(typeof summary.releaseCriticalCount, "number");
  assert.equal(typeof summary.productionProvenCount, "number");
  assert.equal(typeof summary.engineeringOrVerificationCount, "number");
  assert.equal(typeof summary.ownerActionCount, "number");
  assert.equal(typeof summary.mixedActionCount, "number");
  assert.equal(
    summary.productionProvenCount +
      summary.engineeringOrVerificationCount +
      summary.ownerActionCount +
      summary.mixedActionCount,
    summary.releaseCriticalCount,
    "the four action counts must partition the release-critical gate total exactly",
  );
});
