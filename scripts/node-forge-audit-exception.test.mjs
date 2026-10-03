import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const GHSA = "GHSA-86w9-cpqp-85rv";
const REVIEW_AFTER = "2026-11-03";

const workspace = readFileSync("pnpm-workspace.yaml", "utf8");
const lockfile = readFileSync("pnpm-lock.yaml", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const regression = readFileSync(
  "packages/mobile/test/nodeForgeDigestInfo.test.ts",
  "utf8",
);

assert.match(
  workspace,
  /auditConfig:\s*\n\s*ignoreGhsas:\s*\n\s*- GHSA-86w9-cpqp-85rv\b/,
  "governance exception must name exactly the approved GHSA",
);
assert.match(
  workspace,
  /patchedDependencies:\s*\n\s*node-forge@1\.4\.0:\s*patches\/node-forge@1\.4\.0\.patch/,
  "the ignored GHSA must have a local node-forge patch",
);
assert.match(
  lockfile,
  /patchedDependencies:\s*\n\s*node-forge@1\.4\.0:\s*\n\s+hash:\s+[^\n]+\n\s+path:\s+patches\/node-forge@1\.4\.0\.patch/,
  "lockfile must pin the patched dependency and patch hash",
);
assert(existsSync("patches/node-forge@1.4.0.patch"), "node-forge patch file is missing");
assert(
  readFileSync("patches/node-forge@1.4.0.patch", "utf8").length > 0,
  "node-forge patch file is empty",
);
assert.match(
  regression,
  /GHSA-86w9-cpqp-85rv/,
  "load-bearing regression test must reference the approved GHSA",
);
assert.match(
  regression,
  /nested DigestAlgorithm/i,
  "regression test must exercise the nested DigestAlgorithm case",
);
assert.match(
  regression,
  /assert\.throws/,
  "regression test must reject the forged signature",
);
assert.equal(
  packageJson.packageManager,
  "pnpm@10.17.1",
  "exception contract is tied to the repository's pinned package manager",
);

const reviewDate = new Date(REVIEW_AFTER + "T00:00:00Z");
if (Number.isNaN(reviewDate.valueOf())) {
  throw new Error("invalid review date");
}
if (Date.now() >= reviewDate.valueOf()) {
  throw new Error("node-forge audit exception review date reached: " + REVIEW_AFTER);
}

console.log(
  "node-forge-audit-exception=PASS ghsa=" + GHSA + " review_after=" + REVIEW_AFTER,
);
