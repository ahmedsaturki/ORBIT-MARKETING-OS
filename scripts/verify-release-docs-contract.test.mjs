#!/usr/bin/env node
/**
 * Contract test for scripts/verify-release-docs.mjs.
 *
 * It enforces the rule in .omp/RULES.md that durable release documents must
 * never describe a moving main commit by hard-coded SHA. That rule exists
 * because such a claim silently goes stale the moment the next commit lands,
 * and a release document that lies about what is verified is worse than one
 * that admits a gap.
 *
 * The script also cross-checks LAUNCH_SCORECARD.md against readiness.json, so
 * the scorecard cannot mark production web provenance VERIFIED while the
 * web_production gate is still below L3.
 *
 * It runs in ci.yml and had no test. ORBIT_DOCS_ROOT points it at a fixture
 * tree; unset, it reads the repository.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const VERIFIER = join(root, "scripts", "verify-release-docs.mjs");

const DURABLE = [
  "docs/ACCEPTANCE_MATRIX_V2.md",
  "docs/COMMERCIAL_PRODUCTION_PROVEN_RUNBOOK.md",
  "docs/DISTRIBUTION.md",
  "docs/FINAL_EXTERNAL_ACTIONS.md",
  "docs/LAUNCH_SCORECARD.md",
  "docs/RELEASE_READINESS.md",
  "docs/RELEASE_SCORECARD.md",
  "docs/VERIFICATION_BLOCKERS.md",
  "release/readiness.json",
];

const CLEAN = "# Release notes\n\nHistorical evidence only.\n";
const SCORECARD_CLEAN =
  "| Production web provenance | L2 | PARTIAL |\n| Other row | x | y |\n";

async function fixture({
  overrides = {},
  readiness = { releaseCritical: { web_production: { level: "L2_VERIFIED" } } },
  scorecard = SCORECARD_CLEAN,
} = {}) {
  const files = { ...Object.fromEntries(DURABLE.map((p) => [p, CLEAN])) };
  files["release/readiness.json"] = JSON.stringify(readiness, null, 2);
  files["docs/LAUNCH_SCORECARD.md"] = scorecard;
  for (const [k, v] of Object.entries(overrides)) files[k] = v;
  for (const [k, v] of Object.entries(overrides)) files[k] = v;

  const base = await mkdtemp(join(tmpdir(), "orbit-docs-"));
  for (const [rel, body] of Object.entries(files)) {
    const full = join(base, rel);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, body);
  }
  return base;
}

function run(tree) {
  return new Promise((done) => {
    const child = spawn(process.execPath, [VERIFIER], {
      env: { ...process.env, ORBIT_DOCS_ROOT: tree ?? "" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (code) => done({ code, stdout, stderr }));
  });
}

const trees = [];
async function passes(label, opts) {
  const tree = await fixture(opts);
  trees.push(tree);
  const r = await run(tree);
  assert.equal(
    r.code,
    0,
    `${label}: expected pass, got ${r.stdout}${r.stderr}`,
  );
  console.log(`  ok - ${label}`);
}

async function rejects(label, opts, needle) {
  const tree = await fixture(opts);
  trees.push(tree);
  const r = await run(tree);
  assert.equal(r.code, 1, `${label}: expected rejection, got code ${r.code}`);
  assert.match(r.stdout + r.stderr, needle, `${label}: message mismatch`);
  console.log(`  ok - ${label}`);
}

console.log("verify-release-docs contract");

{
  const r = await run(undefined);
  assert.equal(r.code, 0, `real repository failed: ${r.stderr}`);
  assert.match(r.stdout, /release-docs=PASS/);
  assert.match(r.stdout, /durable-release-files=9/);
  console.log("  ok - the real repository still passes (override inert)");
}

await passes("a clean tree passes");

// Every forbidden claim shape, in one durable file.
const forbidden = [
  "Current main 1234567",
  "Current main: 1234567",
  "Current main is `1234567890abcdef1234567890abcdef12345678`",
  "current-main SHA: 1234567",
  "Current verified production deployment is `dpl_example123`.",
  "Current main production provenance is verified for SHA `1234567`.",
];

for (const [i, line] of forbidden.entries()) {
  await rejects(
    `forbidden claim ${i + 1} rejected in a durable doc`,
    { overrides: { "docs/DISTRIBUTION.md": `${CLEAN}\n${line}\n` } },
    /release-docs=FAIL/,
  );
}

// The same text outside a durable file is not checked, which is the point of
// the durable-file list.
await passes("a forbidden-shaped line in a non-durable file is ignored", {
  overrides: { "docs/NOT_DURABLE.md": "Current main 1234567\n" },
});

// Historical evidence must remain allowed, or the rule becomes unusable.
for (const line of [
  "The last verified main SHA `1234567` is historical evidence.",
  "The exact main SHA `1234567` was verified by CI.",
]) {
  await passes(`historical SHA evidence allowed: ${line.slice(0, 28)}…`, {
    overrides: { "docs/DISTRIBUTION.md": `${CLEAN}\n${line}\n` },
  });
}

// The scorecard cross-check.
await rejects(
  "scorecard VERIFIED while web_production is below L3",
  { scorecard: "| Production web provenance | sha | VERIFIED |\n" },
  /cannot mark production web provenance VERIFIED before web_production is L3/,
);
await passes("scorecard VERIFIED once web_production is L3", {
  readiness: {
    releaseCritical: { web_production: { level: "L3_PRODUCTION_PROVEN" } },
  },
  scorecard: "| Production web provenance | sha | VERIFIED |\n",
});
await passes("scorecard without the provenance row is not judged on it", {
  scorecard: "| Some other metric | x | VERIFIED |\n",
});

// Deliberately not claimed as covered: the script self-tests its own patterns
// before scanning, and a mutation test showed that bypassing that self-test
// does NOT fail this suite. The fixtures above hard-code the same claim shapes
// the verifier's patterns are built from, so a broken pattern fails them
// identically. Covering it needs fixtures generated from the patterns
// themselves, which would make the test circular. Recorded in
// FINAL_STATE_MODEL.md instead.

for (const tree of trees) await rm(tree, { recursive: true, force: true });

console.log("verify-release-docs-contract=PASS");
