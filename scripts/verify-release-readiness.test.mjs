import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const script = "scripts/verify-release-readiness.mjs";

describe("release readiness verifier", () => {
  it("fails closed for the commercial lane while any critical gate is below L3", () => {
    expect(() =>
      execFileSync(process.execPath, [script, "--mode", "commercial"], {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: "pipe",
      }),
    ).toThrow();

    try {
      execFileSync(process.execPath, [script, "--mode", "commercial"], {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: "pipe",
      });
    } catch (error: unknown) {
      const result = error as {
        status?: number;
        stdout?: string;
        stderr?: string;
      };
      expect(result.status).toBe(2);
      expect(result.stdout ?? "").toContain("production-proven=0");
      expect(result.stderr ?? "").toContain("commercial-release=BLOCKED");
    }
  });

  it("rejects unknown modes without printing a pass result", () => {
    expect(() =>
      execFileSync(process.execPath, [script, "--mode", "unknown"], {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: "pipe",
      }),
    ).toThrow();

    try {
      execFileSync(process.execPath, [script, "--mode", "unknown"], {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: "pipe",
      });
    } catch (error: unknown) {
      const result = error as {
        status?: number;
        stdout?: string;
        stderr?: string;
      };
      expect(result.status).toBe(1);
      expect(result.stdout ?? "").not.toContain("release-readiness=PASS");
      expect(result.stderr ?? "").toContain("Mode must be verification or commercial.");
    }
  });
});
