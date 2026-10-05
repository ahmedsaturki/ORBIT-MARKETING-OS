#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ORBIT_DOCS_ROOT lets the contract test point this verifier at a fixture tree.
// Unset, it resolves the repository the way the original did.
const root = process.env.ORBIT_DOCS_ROOT
  ? resolve(process.env.ORBIT_DOCS_ROOT)
  : resolve(dirname(fileURLToPath(import.meta.url)), "..");
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
  /current[\s_-]+main\s*(?:is\s*)?(?:sha\s*)?[:=]?\s*[`'"]?[0-9a-f]{7,40}[`'"]?/i,
  /current[\s_-]+main\s+sha\s*[:=]\s*[`'"]?[0-9a-f]{7,40}[`'"]?/i,
  /current(?:ly)?\s+verified\s+production\s+deployment\s+is\s+[`'"]?dpl_[A-Za-z0-9]+[`'"]?/i,
  /current[\s_-]+main\s+production\s+provenance\s+is\s+verified\s+for\s+(?:SHA\s+)?[`'"]?[0-9a-f]{7,40}[`'"]?/i,
];

const contractFixtures = [
  { value: "Current main 1234567", forbidden: true },
  { value: "Current main: 1234567", forbidden: true },
  {
    value: "Current main is `1234567890abcdef1234567890abcdef12345678`",
    forbidden: true,
  },
  { value: "current-main SHA: 1234567", forbidden: true },
  {
    value: "Current verified production deployment is `dpl_example123`.",
    forbidden: true,
  },
  {
    value: "Current main production provenance is verified for SHA `1234567`.",
    forbidden: true,
  },
  {
    value: "The last verified main SHA `1234567` is historical evidence.",
    forbidden: false,
  },
  {
    value: "The exact main SHA `1234567` was verified by CI.",
    forbidden: false,
  },
];

for (const fixture of contractFixtures) {
  const matched = forbiddenCurrentMainShaPatterns.some((pattern) =>
    pattern.test(fixture.value),
  );
  if (matched !== fixture.forbidden) {
    throw new Error("release docs guard self-test failed: " + fixture.value);
  }
}

const readiness = JSON.parse(
  await readFile(resolve(root, "release/readiness.json"), "utf8"),
);

const launchScorecard = await readFile(
  resolve(root, "docs/LAUNCH_SCORECARD.md"),
  "utf8",
);
const webProvenanceRow = launchScorecard
  .split(/\r?\n/)
  .find((line) => line.startsWith("| Production web provenance"));
const webProductionLevel = readiness.releaseCritical?.web_production?.level;

if (
  typeof webProvenanceRow === "string" &&
  typeof webProductionLevel === "string" &&
  webProductionLevel !== "L3_PRODUCTION_PROVEN" &&
  /\|\s*VERIFIED\s*\|/.test(webProvenanceRow)
) {
  throw new Error(
    "launch scorecard cannot mark production web provenance VERIFIED before web_production is L3",
  );
}

const failures = [];

for (const relativePath of durableReleaseFiles) {
  const content = await readFile(resolve(root, relativePath), "utf8");
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const pattern of forbiddenCurrentMainShaPatterns) {
      const match = pattern.exec(line);
      if (!match) continue;

      failures.push(
        relativePath +
          ":" +
          (index + 1) +
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
