import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { childEnv, resolveTool } from "./child-env.mjs";

const source = await readFile("scripts/collect-release-evidence.mjs", "utf8");
const securitySource = await readFile("scripts/security-scan.mjs", "utf8");
const recoverySource = await readFile("scripts/recovery-evidence.mjs", "utf8");
const childEnvSource = await readFile("scripts/child-env.mjs", "utf8");

for (const marker of [
  'const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");',
  "cwd: repoRoot,",
  "evidenceRefs: value.evidenceRefs ?? [],",
  "verifiedAt: value.verifiedAt ?? null,",
  'import { childEnv, resolveTool } from "./child-env.mjs";',
]) {
  assert.equal(
    source.includes(marker),
    true,
    `missing release evidence collector hardening marker: ${marker}`,
  );
}

const requiredGitOverrides = [
  '"GIT_DIR",',
  '"GIT_WORK_TREE",',
  '"GIT_INDEX_FILE",',
  '"GIT_COMMON_DIR",',
  '"GIT_OBJECT_DIRECTORY",',
  '"GIT_ALTERNATE_OBJECT_DIRECTORIES",',
  '"GIT_NAMESPACE",',
];

const requiredRepoBinding = [
  [
    "security scan",
    securitySource,
    'const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");',
    "cwd: repoRoot,",
  ],
  [
    "recovery evidence",
    recoverySource,
    'const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");',
    "cwd: root,",
  ],
];

// The Git override sanitization now lives in the shared child-env module that
// every spawning script imports, so assert it there.
for (const marker of requiredGitOverrides) {
  assert.equal(
    childEnvSource.includes(marker),
    true,
    `shared child env missing Git override sanitization marker: ${marker}`,
  );
}

for (const [label, content] of [
  ["collector", source],
  ["security scan", securitySource],
  ["recovery evidence", recoverySource],
]) {
  assert.equal(
    content.includes('from "./child-env.mjs"'),
    true,
    `${label} must spawn through the sanitized child environment`,
  );
}

for (const [label, content, rootMarker, cwdMarker] of requiredRepoBinding) {
  assert.equal(
    content.includes(rootMarker),
    true,
    `${label} missing repository-root marker`,
  );
  assert.equal(
    content.includes(cwdMarker),
    true,
    `${label} missing bound Git cwd marker`,
  );
}

const testRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const expectedSha = execFileSync(resolveTool("git"), ["rev-parse", "HEAD"], {
  cwd: testRoot,
  encoding: "utf8",
  env: childEnv("git"),
}).trim();

const hostileDir = mkdtempSync(join(tmpdir(), "orbit-release-evidence-"));
try {
  const outputPath = join(hostileDir, "evidence.json");
  const hostileEnv = {
    ...process.env,
    GIT_DIR: join(hostileDir, "not-a-git-directory"),
    GIT_WORK_TREE: hostileDir,
    GIT_INDEX_FILE: join(hostileDir, "fake-index"),
    GIT_COMMON_DIR: join(hostileDir, "not-a-common-dir"),
    GIT_OBJECT_DIRECTORY: join(hostileDir, "not-a-objects-dir"),
    GIT_ALTERNATE_OBJECT_DIRECTORIES: join(
      hostileDir,
      "not-a-alternate-objects-dir",
    ),
    GIT_NAMESPACE: "hostile-test-namespace",
  };

  execFileSync(
    process.execPath,
    [
      fileURLToPath(new URL("./collect-release-evidence.mjs", import.meta.url)),
      "--output",
      outputPath,
    ],
    {
      cwd: hostileDir,
      encoding: "utf8",
      env: hostileEnv,
    },
  );

  const evidence = JSON.parse(await readFile(outputPath, "utf8"));
  assert.equal(
    evidence.git.sha,
    expectedSha,
    "collector must read HEAD from its repository root even with hostile Git environment overrides",
  );
  assert.equal(
    evidence.git.status,
    "",
    "collector should report the repository worktree state, not the hostile caller cwd",
  );
} finally {
  rmSync(hostileDir, { recursive: true, force: true });
}

console.log("release_evidence_collector_contract=PASS");
