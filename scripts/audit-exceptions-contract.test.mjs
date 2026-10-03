import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const NODE_FORGE_GHSA = "GHSA-86w9-cpqp-85rv";
const BRACES_GHSA = "GHSA-vfj7-8cjw-p6xm";
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
  ignoredGhsas.sort(),
  [BRACES_GHSA, NODE_FORGE_GHSA].sort(),
  "only the two explicitly approved temporary exceptions may be ignored",
);

assert.match(
  workspace,
  /patchedDependencies:\s*\n\s*node-forge@1\.4\.0:\s*patches\/node-forge@1\.4\.0\.patch/,
  "the node-forge exception must have a local patch",
);
assert(!/braces@3\.0\.3:/i.test(workspace), "braces must not gain an unreviewed local patch declaration");

const nodeForgeLockMatch = lockfile.match(
  /patchedDependencies:\s*\n\s*node-forge@1\.4\.0:\s*\n\s+hash:\s+([^\n]+)\n\s+path:\s+patches\/node-forge@1\.4\.0\.patch/,
);
assert(nodeForgeLockMatch, "lockfile must pin the node-forge patch");
assert.equal(
  nodeForgeLockMatch[1].trim(),
  EXPECTED_PATCH_HASH,
  "node-forge patch hash must match the reviewed artifact",
);
assert(existsSync("patches/node-forge@1.4.0.patch"), "node-forge patch file is missing");
const patch = readFileSync("patches/node-forge@1.4.0.patch", "utf8");
assert.equal(
  createHash("sha256").update(patch).digest("hex"),
  EXPECTED_PATCH_HASH,
  "committed node-forge patch does not match the reviewed hash",
);

assert.match(
  regression,
  /GHSA-86w9-cpqp-85rv/,
  "node-forge regression test must reference the approved GHSA",
);
assert.match(
  regression,
  /nested DigestAlgorithm/i,
  "node-forge regression test must exercise the nested DigestAlgorithm case",
);
assert.match(regression, /assert\.throws/, "node-forge regression must reject the forged signature");

assert.equal(packageJson.packageManager, "pnpm@10.17.1");

const bracesPath =
  "packages__mobile>expo>@expo/cli>@expo/metro-file-map>micromatch>braces";
assert(lockfile.includes(bracesPath), "braces exception must match the Expo CLI build-tooling path");
assert.match(lockfile, /braces@3\.0\.3:/, "expected vulnerable braces version must remain explicitly visible");
assert(!lockfile.match(/packages__mobile>expo>@expo\/cli>[^\n]*braces[^\n]*<unknown>/i), "unexpected malformed braces dependency path");

const reviewDate = new Date(REVIEW_AFTER + "T00:00:00Z");
assert(!Number.isNaN(reviewDate.valueOf()), "invalid exception review date");
if (Date.now() >= reviewDate.valueOf()) {
  throw new Error("audit exception review date reached: " + REVIEW_AFTER);
}

console.log(
  "audit-exceptions=PASS ghsas=" +
    [NODE_FORGE_GHSA, BRACES_GHSA].join(",") +
    " review_after=" +
    REVIEW_AFTER,
);
