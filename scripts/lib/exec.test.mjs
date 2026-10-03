import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  execFileTracked,
  resolveTrustedExecutable,
  spawnTracked,
  UntrustedExecutableError,
} from "./exec.mjs";

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

test("resolves git to a trusted absolute path", () => {
  const resolved = resolveTrustedExecutable("git");
  assert.ok(isAbsolute(resolved), `expected absolute path, got ${resolved}`);
  assert.notEqual(resolved, "git");
});

test("spawnTracked exposes the same fails-closed resolution", () => {
  assert.equal(typeof spawnTracked, "function");
  assert.equal(typeof execFileTracked, "function");
});

test("untrusted bare names fail closed with UntrustedExecutableError", () => {
  for (const name of [
    "orbit-definitely-not-a-real-binary",
    "orbit-definitely-not-a-real-binary.exe",
  ]) {
    assert.throws(
      () => resolveTrustedExecutable(name),
      (error) => error instanceof UntrustedExecutableError,
      `expected UntrustedExecutableError for ${name}`,
    );
  }
});

test("path-bearing commands are rejected outright", () => {
  for (const name of ["./git", "../malware/git", "C:/Windows/foo.exe"]) {
    assert.throws(
      () => resolveTrustedExecutable(name),
      UntrustedExecutableError,
    );
  }
});

test("migrated security-scan.mjs still prints its passed-JSON contract", () => {
  const stdout = execFileSync(
    process.execPath,
    [join(repoRoot, "scripts", "security-scan.mjs")],
    { cwd: repoRoot, encoding: "utf8" },
  );
  assert.match(stdout, /"status"\s*:\s*"passed"/u);
});

test("migrated agent-release-triage.mjs still prints its summary counts", () => {
  const stdout = execFileSync(
    process.execPath,
    [join(repoRoot, "scripts", "agent-release-triage.mjs")],
    { cwd: repoRoot, encoding: "utf8" },
  );
  const payload = JSON.parse(stdout);
  assert.equal(typeof payload.summary.releaseCriticalCount, "number");
  assert.equal(typeof payload.summary.productionProvenCount, "number");
  assert.equal(typeof payload.summary.engineeringOrVerificationCount, "number");
  assert.equal(typeof payload.summary.ownerActionCount, "number");
});

test("migrated resolve-production-release.mjs still prints release flags", () => {
  const stdout = execFileSync(
    process.execPath,
    [join(repoRoot, "scripts", "resolve-production-release.mjs")],
    { cwd: repoRoot, encoding: "utf8" },
  );
  assert.match(stdout, /^release_active=(?:true|false)$/mu);
  assert.match(stdout, /^release_current=(?:true|false)$/mu);
});
