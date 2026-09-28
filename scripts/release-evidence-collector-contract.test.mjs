import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFile, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const source = await readFile("scripts/collect-release-evidence.mjs", "utf8");
const securitySource = await readFile("scripts/security-scan.mjs", "utf8");
const recoverySource = await readFile("scripts/recovery-evidence.mjs", "utf8");

for (const marker of [
  'const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");',
  "cwd: repoRoot,",
  '"GIT_DIR",',
  '"GIT_WORK_TREE",',
  '"GIT_INDEX_FILE",',
  '"GIT_COMMON_DIR",',
  '"GIT_OBJECT_DIRECTORY",',
  '"GIT_ALTERNATE_OBJECT_DIRECTORIES",',
  '"GIT_NAMESPACE",',
  "evidenceRefs: value.evidenceRefs ?? [],",
  "verifiedAt: value.verifiedAt ?? null,",
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

for (const marker of requiredGitOverrides) {
  for (const [label, content] of [
    ["security scan", securitySource],
    ["recovery evidence", recoverySource],
  ]) {
    assert.equal(
      content.includes(marker),
      true,
      `${label} missing Git override sanitization marker: ${marker}`,
    );
  }
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
const expectedSha = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: testRoot,
  encoding: "utf8",
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
    [fileURLToPath(new URL("./collect-release-evidence.mjs", import.meta.url)), "--output", outputPath],
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
