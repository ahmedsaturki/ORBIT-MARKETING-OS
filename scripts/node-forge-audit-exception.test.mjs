import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const GHSA = "GHSA-86w9-cpqp-85rv";
const REVIEW_AFTER = "2026-11-03";
const EXPECTED_PATCH_HASH =
  "1da5306df32cb00fb9309034ffcd35c1126ccd13ce79f5f0031825ad79bbab27";

const workspace = readFileSync("pnpm-workspace.yaml", "utf8");
const lockfile = readFileSync("pnpm-lock.yaml", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const regression = readFileSync(
  "packages/mobile/test/nodeForgeDigestInfo.test.ts",
  "utf8",
);

const ignoreMatch = workspace.match(
  /auditConfig:\s*\n\s*ignoreGhsas:\s*\n((?:\s+-\s+[^\n]+\n?)+)/,
);
assert(ignoreMatch, "governance exception configuration is missing");
const ignoredGhsas = ignoreMatch[1]
  .split("\n")
  .map((line) => line.trim().replace(/^-\s+/, "").trim())
  .filter(Boolean);
assert.deepEqual(
  ignoredGhsas,
  [GHSA],
  "only the approved GHSA may be ignored by the package-manager audit",
);

assert.match(
  workspace,
  /patchedDependencies:\s*\n\s*node-forge@1\.4\.0:\s*patches\/node-forge@1\.4\.0\.patch/,
  "the ignored GHSA must have a local node-forge patch",
);

const lockMatch = lockfile.match(
  /patchedDependencies:\s*\n\s*node-forge@1\.4\.0:\s*\n\s+hash:\s+([^\n]+)\n\s+path:\s+patches\/node-forge@1\.4\.0\.patch/,
);
assert(lockMatch, "lockfile must pin the patched dependency and patch hash");
assert.equal(
  lockMatch[1].trim(),
  EXPECTED_PATCH_HASH,
  "lockfile patch hash must match the reviewed patch artifact",
);

assert(existsSync("patches/node-forge@1.4.0.patch"), "node-forge patch file is missing");
const patch = readFileSync("patches/node-forge@1.4.0.patch", "utf8");
assert(patch.length > 0, "node-forge patch file is empty");
const actualPatchHash = createHash("sha256").update(patch).digest("hex");
assert.equal(
  actualPatchHash,
  EXPECTED_PATCH_HASH,
  "committed node-forge patch does not match the lockfile hash",
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
