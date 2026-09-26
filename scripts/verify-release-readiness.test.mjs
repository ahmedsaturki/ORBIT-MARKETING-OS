import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const script = "scripts/verify-release-readiness.mjs";

function runVerifier(mode) {
  try {
    execFileSync(process.execPath, [script, "--mode", mode], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: "pipe",
    });
  } catch (error) {
    return {
      status: error?.status ?? -1,
      stdout: error?.stdout ?? "",
      stderr: error?.stderr ?? "",
    };
  }

  throw new Error("verifier unexpectedly passed");
}

describe("release readiness verifier", () => {
  it("fails closed for the commercial lane while any critical gate is below L3", () => {
    const result = runVerifier("commercial");
    expect(result.status).toBe(2);
    expect(result.stdout).toContain("production-proven=0");
    expect(result.stderr).toContain("commercial-release=BLOCKED");
  });

  it("rejects unknown modes without printing a pass result", () => {
    const result = runVerifier("unknown");
    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain("release-readiness=PASS");
    expect(result.stderr).toContain("Mode must be verification or commercial.");
  });
});
