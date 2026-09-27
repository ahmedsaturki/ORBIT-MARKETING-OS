import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const script = "scripts/verify-release-readiness.mjs";

function run(mode, env = {}) {
  try {
    const stdout = execFileSync(process.execPath, [script, "--mode", mode], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    return {
      status: error?.status ?? -1,
      stdout: error?.stdout ?? "",
      stderr: error?.stderr ?? "",
    };
  }
}

const verification = run("verification");
assert.equal(verification.status, 0);
assert.match(verification.stdout, /release-readiness=PASS mode=verification/);

const commercial = run("commercial");
assert.equal(commercial.status, 2);
assert.match(commercial.stdout, /production-proven=0/);
assert.match(commercial.stderr, /commercial-release=BLOCKED/);

const tempDirectory = mkdtempSync(join(tmpdir(), "orbit-readiness-"));
try {
  const invalidL3 = join(tempDirectory, "invalid.json");
  writeFileSync(
    invalidL3,
    JSON.stringify({
      schemaVersion: 1,
      readinessLevels: [
        "L0_DESIGNED",
        "L1_IMPLEMENTED",
        "L2_VERIFIED",
        "L3_PRODUCTION_PROVEN",
      ],
      releaseCritical: {
        fake_gate: {
          level: "L3_PRODUCTION_PROVEN",
          evidence: ["manual claim"],
          notes: "not enough proof",
        },
      },
      rule: "every gate must be L3",
    }),
  );

  const invalid = run("commercial", { ORBIT_READINESS_FILE: invalidL3 });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /Invalid gate levels: fake_gate/);

  const impossibleDate = join(tempDirectory, "impossible-date.json");
  writeFileSync(
    impossibleDate,
    JSON.stringify({
      schemaVersion: 1,
      readinessLevels: [
        "L0_DESIGNED",
        "L1_IMPLEMENTED",
        "L2_VERIFIED",
        "L3_PRODUCTION_PROVEN",
      ],
      releaseCritical: {
        impossible_date: {
          level: "L3_PRODUCTION_PROVEN",
          evidence: ["workflow run 124"],
          evidenceRefs: ["gha://runs/124"],
          verifiedAt: "2026-02-30T00:00:00Z",
          notes: "impossible calendar date",
        },
      },
      rule: "every gate must be L3",
    }),
  );

  const impossible = run("commercial", {
    ORBIT_READINESS_FILE: impossibleDate,
  });
  assert.equal(impossible.status, 1);
  assert.match(impossible.stderr, /Invalid gate levels: impossible_date/);


  const validL3 = join(tempDirectory, "valid.json");
  writeFileSync(
    validL3,
    JSON.stringify({
      schemaVersion: 1,
      readinessLevels: [
        "L0_DESIGNED",
        "L1_IMPLEMENTED",
        "L2_VERIFIED",
        "L3_PRODUCTION_PROVEN",
      ],
      releaseCritical: {
        proven_gate: {
          level: "L3_PRODUCTION_PROVEN",
          evidence: ["workflow run 123"],
          evidenceRefs: ["gha://runs/123"],
          verifiedAt: "2026-09-27T00:00:00Z",
          notes: "verified proof",
        },
      },
      rule: "every gate must be L3",
    }),
  );

  const valid = run("commercial", { ORBIT_READINESS_FILE: validL3 });
  assert.equal(valid.status, 0);
  assert.match(valid.stdout, /production-proven=1/);
  assert.doesNotMatch(valid.stderr, /commercial-release=BLOCKED/);
} finally {
  rmSync(tempDirectory, { recursive: true, force: true });
}

const unknown = run("unknown");
assert.equal(unknown.status, 1);
assert.doesNotMatch(unknown.stdout, /release-readiness=PASS/);
assert.match(unknown.stderr, /Mode must be verification or commercial\./);

console.log("release-readiness-verifier-contract=PASS");
