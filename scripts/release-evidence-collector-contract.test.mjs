import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile("scripts/collect-release-evidence.mjs", "utf8");

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

console.log("release_evidence_collector_contract=PASS");
