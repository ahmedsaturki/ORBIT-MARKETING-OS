#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const durableReleaseFiles = [
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

// Historical exact-SHA evidence is valid. What is forbidden is a durable
// release document asserting that a specific hash is the moving current-main
// SHA. Keep these patterns narrow so phrases such as 'last verified main SHA'
// remain valid historical evidence.
const forbiddenCurrentMainShaPatterns = [
  /current[\s_-]+main\s*(?:is\s*)?(?:sha\s*[:=]\s*)?[`'\"]?[0-9a-f]{7,40}[`'\"]?/i,
  /current[\s_-]+main\s+sha\s*[:=]\s*[`'\"]?[0-9a-f]{7,40}[`'\"]?/i,
];

const failures = [];

for (const relativePath of durableReleaseFiles) {
  const content = await readFile(resolve(root, relativePath), "utf8");
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const pattern of forbiddenCurrentMainShaPatterns) {
      const match = pattern.exec(line);
      if (!match) continue;

      failures.push(
        relativePath + ":" + (index + 1) +
          " contains a hard-coded moving-main SHA claim: " +
          line.trim(),
      );
      break;
    }
  });
}

if (failures.length > 0) {
  console.error("release-docs=FAIL");
  for (const failure of failures) console.error(failure);
  process.exit(1);
}

console.log("release-docs=PASS");
console.log("durable-release-files=" + durableReleaseFiles.length);
console.log(
  "rule=historical exact-SHA evidence is allowed; hard-coded moving current-main SHA claims are forbidden",
);
