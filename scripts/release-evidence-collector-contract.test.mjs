import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile("scripts/collect-release-evidence.mjs", "utf8");
const securitySource = await readFile("scripts/security-scan.mjs", "utf8");
const recoverySource = await readFile("scripts/recovery-evidence.mjs", "utf8");

for (const marker of [
  'const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");',
  'cwd: repoRoot,',
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

console.log("release_evidence_collector_contract=PASS");
