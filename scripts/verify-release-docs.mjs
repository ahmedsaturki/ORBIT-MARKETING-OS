#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname, "..");
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

const movingMainShaPattern =
  /current[\s\-_]+main(?:[\s]+(?:is|sha|head|commit))?[^0-9a-f]{0,80}(?:[0-9a-f]{7,40})/i;

const failures = [];

for (const relativePath of durableReleaseFiles) {
  const content = await readFile(resolve(root, relativePath), "utf8");
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (movingMainShaPattern.test(line)) {
      failures.push(
        `${relativePath}:${index + 1} contains a moving-main SHA claim: ${line.trim()}`,
      );
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
console.log("rule=historical exact-SHA evidence is allowed; moving current-main SHA claims are forbidden");
