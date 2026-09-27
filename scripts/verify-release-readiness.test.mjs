import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const script = "scripts/verify-release-readiness.mjs";

function run(mode) {
  try {
    const stdout = execFileSync(process.execPath, [script, "--mode", mode], {
      cwd: process.cwd(),
      encoding: "utf8",
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

const unknown = run("unknown");
assert.equal(unknown.status, 1);
assert.doesNotMatch(unknown.stdout, /release-readiness=PASS/);
assert.match(unknown.stderr, /Mode must be verification or commercial\./);

console.log("release-readiness-verifier-contract=PASS");
