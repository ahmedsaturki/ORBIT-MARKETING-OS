#!/usr/bin/env node
/**
 * Contract test for scripts/verify-omp-contract.mjs.
 *
 * It runs in ci.yml and enforces that the OMP operator protocol stays intact:
 * eleven required files exist, five carry mandatory markers, and the five agent
 * definitions have unique frontmatter names. It had no test, so a deleted agent
 * file or a duplicated name would only surface by luck.
 *
 * ORBIT_OMP_ROOT points it at a fixture tree; unset, it reads the repository.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const VERIFIER = join(root, "scripts", "verify-omp-contract.mjs");

const AGENTS = [
  ["forensics", "Investigates defects."],
  ["implementer", "Writes the change."],
  ["verifier", "Proves the change."],
  ["release-auditor", "Audits release claims."],
  ["reviewer", "Reviews code."],
];

/** A fixture tree that passes, optionally mutated by `mutate`. */
async function fixture(mutate = () => {}) {
  const files = {
    ".omp/AGENTS.md": "see @../AGENTS.md and @../docs/OMP_OPERATOR_PROTOCOL.md",
    ".omp/RULES.md": "L3_PRODUCTION_PROVEN and OWNER_ACTION are both required",
    "WATCHDOG.md": "Release-truth drift and workspace/RBAC boundaries",
    "WATCHDOG.yml": "advisors:\n  - ReleaseTruth\n  - SecurityRuntime",
    "docs/OMP_OPERATOR_PROTOCOL.md":
      "SPEC → IMPLEMENT → TEST. Do not simulate or fabricate these proofs.",
    "scripts/agent-release-triage.mjs": "export default 1;\n",
  };
  for (const [name, description] of AGENTS) {
    files[`.omp/agents/${name}.md`] =
      `---\nname: ${name}\ndescription: ${description}\n---\nbody\n`;
  }
  mutate(files);

  const base = await mkdtemp(join(tmpdir(), "orbit-omp-"));
  for (const [rel, body] of Object.entries(files)) {
    if (body === null) continue; // deleted
    const full = join(base, rel);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, body);
  }
  return base;
}

function run(tree) {
  return new Promise((done) => {
    const child = spawn(process.execPath, [VERIFIER], {
      env: { ...process.env, ORBIT_OMP_ROOT: tree ?? "" },
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
async function passes(label, mutate) {
  const tree = await fixture(mutate);
  trees.push(tree);
  const r = await run(tree);
  assert.equal(
    r.code,
    0,
    `${label}: expected pass, got ${r.stdout}${r.stderr}`,
  );
  console.log(`  ok - ${label}`);
}

async function rejects(label, mutate, needle) {
  const tree = await fixture(mutate);
  trees.push(tree);
  const r = await run(tree);
  assert.equal(r.code, 1, `${label}: expected rejection, got code ${r.code}`);
  assert.match(
    r.stdout + r.stderr,
    needle,
    `${label}: message did not mention ${needle}`,
  );
  console.log(`  ok - ${label}`);
}

console.log("verify-omp contract");

// The override must be inert when unset.
{
  const r = await run(undefined);
  assert.equal(r.code, 0, `real repository failed: ${r.stderr}`);
  assert.match(r.stdout, /omp_contract=PASS/);
  console.log("  ok - the real repository still passes (override inert)");
}

await passes("a complete fixture passes");
await passes("an extra unrelated file is harmless", (f) => {
  f["docs/EXTRA.md"] = "ignored";
});

// Each mandatory marker, removed in turn.
await rejects(
  "sticky rules losing L3_PRODUCTION_PROVEN",
  (f) => (f[".omp/RULES.md"] = "OWNER_ACTION only"),
  /sticky OMP rules is missing required marker: L3_PRODUCTION_PROVEN/,
);
await rejects(
  "protocol losing the do-not-fabricate rule",
  (f) => (f["docs/OMP_OPERATOR_PROTOCOL.md"] = "SPEC → IMPLEMENT → TEST"),
  /Do not simulate or fabricate these proofs/,
);
// A deleted required file surfaces as ENOENT from access(), not as a curated
// message. The assertion matches the path in that error, which still proves
// the file's absence is what failed.
await rejects(
  ".omp/RULES.md deleted",
  (f) => (f[".omp/RULES.md"] = null),
  /ENOENT/,
);
await rejects(
  "WATCHDOG.md deleted",
  (f) => (f["WATCHDOG.md"] = null),
  /ENOENT/,
);
await rejects(
  "WATCHDOG.yml deleted",
  (f) => (f["WATCHDOG.yml"] = null),
  /ENOENT/,
);
await rejects(
  "docs/OMP_OPERATOR_PROTOCOL.md deleted",
  (f) => (f["docs/OMP_OPERATOR_PROTOCOL.md"] = null),
  /ENOENT/,
);
await rejects(
  "scripts/agent-release-triage.mjs deleted",
  (f) => (f["scripts/agent-release-triage.mjs"] = null),
  /ENOENT/,
);
await rejects(
  ".omp/agents/verifier.md deleted",
  (f) => (f[".omp/agents/verifier.md"] = null),
  /ENOENT/,
);
await rejects(
  "roster losing SecurityRuntime",
  (f) => (f["WATCHDOG.yml"] = "advisors:\n  - ReleaseTruth"),
  /WATCHDOG roster is missing required marker: SecurityRuntime/,
);

await rejects(
  "an agent definition with no frontmatter",
  (f) => (f[".omp/agents/reviewer.md"] = "just a body\n"),
  /must start with YAML frontmatter/,
);
await rejects(
  "an agent definition with an unclosed frontmatter block",
  (f) =>
    (f[".omp/agents/reviewer.md"] = "---\nname: reviewer\ndescription: R\n"),
  /must have a closing frontmatter delimiter/,
);
await rejects(
  "an agent definition missing its description",
  (f) => (f[".omp/agents/reviewer.md"] = "---\nname: reviewer\n---\nbody\n"),
  /must define name and description inside frontmatter/,
);
await rejects(
  "two agents sharing a name",
  (f) => {
    f[".omp/agents/reviewer.md"] =
      "---\nname: forensics\ndescription: Clashing name.\n---\nbody\n";
  },
  /OMP agent names must be unique/,
);

for (const tree of trees) await rm(tree, { recursive: true, force: true });

console.log("verify-omp-contract=PASS");
