#!/usr/bin/env node
/**
 * Contract test for scripts/verify-e2e-parses.mjs.
 *
 * The gate exists because `pnpm typecheck` runs `turbo run typecheck`, which
 * visits only workspace packages, and `e2e/` is not one. A duplicate `const` in
 * a spec once reached CI and failed only after a full push, install, build and
 * browser install, reported by Playwright as a runtime SyntaxError.
 *
 * Its whole job is deciding which tsc diagnostics are real errors in the spec
 * and which are artifacts of --noResolve stopping the compiler from following
 * imports. That filtering is the part worth pinning: widen it and real errors
 * pass, narrow it and resolve noise fails every build.
 *
 * ORBIT_E2E_SPEC_DIR points it at a fixture directory; unset, it reads e2e/.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const VERIFIER = join(root, "scripts", "verify-e2e-parses.mjs");

const CLEAN_SPEC = `import { test, expect } from "@playwright/test";

test("example", async ({ page }) => {
  const value: string = "x";
  expect(value).toBe("x");
});
`;

/** A spec directory containing `files` (path -> contents). */
async function specDir(files) {
  const base = await mkdtemp(join(tmpdir(), "orbit-e2e-"));
  for (const [rel, body] of Object.entries(files)) {
    const full = join(base, rel);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, body);
  }
  return base;
}

function run(dir) {
  return new Promise((done) => {
    const child = spawn(process.execPath, [VERIFIER], {
      env: { ...process.env, ORBIT_E2E_SPEC_DIR: dir ?? "" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (code) => done({ code, stdout, stderr }));
  });
}

const dirs = [];
async function passes(label, files, opts = {}) {
  const dir = await specDir(files);
  dirs.push(dir);
  const r = await run(dir);
  assert.equal(
    r.code,
    0,
    `${label}: expected pass, got ${r.stdout}${r.stderr}`,
  );
  if (opts.expectSpecs !== undefined) {
    assert.match(r.stdout, new RegExp(`specs=${opts.expectSpecs}\\b`));
  }
  console.log(`  ok - ${label}`);
}

async function rejects(label, files, needle) {
  const dir = await specDir(files);
  dirs.push(dir);
  const r = await run(dir);
  assert.equal(r.code, 1, `${label}: expected rejection, got code ${r.code}`);
  assert.match(r.stdout + r.stderr, needle, `${label}: message mismatch`);
  console.log(`  ok - ${label}`);
}

console.log("verify-e2e-parses contract");

{
  const r = await run(undefined);
  assert.equal(r.code, 0, `real e2e/ failed: ${r.stderr}`);
  assert.match(r.stdout, /e2e-parses=PASS specs=\d+/);
  console.log("  ok - the real e2e/ directory still passes (override inert)");
}

// The regression this gate was written for: a duplicate const, which is a
// binding error rather than a parse error. `node --check` passes this file.
await rejects(
  "a duplicate const binding is caught",
  {
    "a.spec.ts": `import { test } from "@playwright/test";
const missionWorkspace = 1;
const missionWorkspace = 2;
test("x", () => {});
`,
  },
  /real error\(s\) in 1 spec\(s\)/,
);

await rejects(
  "a genuine type error is caught",
  {
    "a.spec.ts": `import { test } from "@playwright/test";
const n: number = "not a number";
test("x", () => { void n; });
`,
  },
  /real error\(s\)/,
);

// Resolve noise is what the gate must NOT report. These are exactly the codes
// that --noResolve manufactures, and a spec full of them is normal.
await passes(
  "unresolved imports and implicit any are not reported",
  {
    "a.spec.ts": `import { test, expect } from "@playwright/test";
import { somethingUnknown } from "./helper-that-does-not-exist";

test("example", async ({ page }) => {
  const value = somethingUnknown(page);
  expect(value).toBeDefined();
});
`,
  },
  { expectSpecs: 1 },
);

await passes(
  "a clean spec passes",
  { "a.spec.ts": CLEAN_SPEC },
  {
    expectSpecs: 1,
  },
);

// Recursion into subdirectories is part of collectSpecs' contract.
await passes(
  "specs are collected from nested directories",
  { "a.spec.ts": CLEAN_SPEC, "nested/b.spec.ts": CLEAN_SPEC },
  { expectSpecs: 2 },
);

// An empty directory is an error, not a vacuous pass.
await rejects("no specs found", {}, /no specs found/);

// The "tsc exited without reporting anything" guard: a gate that could not run
// must not report success. tsc is spawned as an argument to node, so a broken
// compiler exits non-zero with a stack trace and no diagnostics -- neither
// spawnSync.error nor signal is set, so the status is the only signal.
async function withStubCompiler(label, body, exitCode, expectCode) {
  const dir = await specDir({ "a.spec.ts": CLEAN_SPEC });
  dirs.push(dir);
  const stub = await specDir({ "tsc-stub.mjs": body });
  dirs.push(stub);
  const bin = join(stub, "tsc-stub.mjs");
  const child = spawn(process.execPath, [VERIFIER], {
    env: {
      ...process.env,
      ORBIT_E2E_SPEC_DIR: dir,
      ORBIT_TSC_BIN: bin,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (d) => (stderr += d));
  const code = await new Promise((done) => child.on("close", done));
  assert.equal(
    code,
    expectCode,
    `${label}: expected exit ${expectCode}, got ${code}`,
  );
  console.log(`  ok - ${label}`);
}

await withStubCompiler(
  "a compiler that crashes is not reported as success",
  "process.stderr.write('boom\\n');\nprocess.exit(3);\n",
  0,
  1,
);
await withStubCompiler(
  "a compiler that exits non-zero with no diagnostics is rejected",
  "process.exit(1);\n",
  0,
  1,
);
await withStubCompiler(
  "a compiler exiting 2 with no diagnostics is still rejected",
  "process.exit(2);\n",
  0,
  1,
);

// A directory that does not exist must not read as "clean".
{
  const missing = join(tmpdir(), "orbit-e2e-does-not-exist-" + Date.now());
  const r = await run(missing);
  assert.equal(r.code, 1, `missing dir: expected rejection, got ${r.code}`);
  console.log("  ok - a missing spec directory is rejected");
}

for (const dir of dirs) await rm(dir, { recursive: true, force: true });

console.log("verify-e2e-parses-contract=PASS");
