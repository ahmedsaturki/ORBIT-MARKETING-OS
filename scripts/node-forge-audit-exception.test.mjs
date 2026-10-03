import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const GHSA = "GHSA-86w9-cpqp-85rv";
const REVIEW_AFTER = "2026-11-03";
const EXPECTED_PATCH_HASH =
  "1da5306df32cb00fb9309034ffcd35c1126ccd13ce79f5f0031825ad79bbab27";

// GHSA-vfj7-8cjw-p6xm ("braces" stack-exhaustion ReDoS) has no released
// patched version and is only reachable through the expo CLI build tooling
// chain, which globs developer-controlled repository paths at build time.
const BRACES_GHSA = "GHSA-vfj7-8cjw-p6xm";
const BRACES_REVIEW_AFTER = "2026-11-03";

const workspace = readFileSync("pnpm-workspace.yaml", "utf8");
const lockfile = readFileSync("pnpm-lock.yaml", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const exceptionsDoc = readFileSync("docs/SECURITY_EXCEPTIONS.md", "utf8");
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
  [GHSA, BRACES_GHSA],
  "only the approved GHSAs may be ignored by the package-manager audit",
);

assert.match(
  workspace,
  /patchedDependencies:\s*\n\s*node-forge@1\.4\.0:\s*patches\/node-forge@1\.4\.0\.patch/,
  "the ignored node-forge GHSA must have a local node-forge patch",
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

assert(
  existsSync("patches/node-forge@1.4.0.patch"),
  "node-forge patch file is missing",
);
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

// The exception register is the human-readable authority; both governed
// exceptions must be recorded there with their review dates.
for (const [ghsa, reviewAfter] of [
  [GHSA, REVIEW_AFTER],
  [BRACES_GHSA, BRACES_REVIEW_AFTER],
]) {
  assert.match(
    exceptionsDoc,
    new RegExp(ghsa.replace(/-/gu, "\\u002d"), "u"),
    `security exception register must record ${ghsa}`,
  );
  assert.match(
    exceptionsDoc,
    new RegExp(`${ghsa.replace(/-/gu, "\\u002d")}[\\s\\S]*${reviewAfter}`, "u"),
    `security exception register must carry the review date for ${ghsa}`,
  );
}

for (const [ghsa, reviewAfter] of [
  [GHSA, REVIEW_AFTER],
  [BRACES_GHSA, BRACES_REVIEW_AFTER],
]) {
  const reviewDate = new Date(reviewAfter + "T00:00:00Z");
  if (Number.isNaN(reviewDate.valueOf())) {
    throw new Error("invalid review date for " + ghsa);
  }
  if (Date.now() >= reviewDate.valueOf()) {
    throw new Error("audit exception review date reached: " + reviewAfter + " (" + ghsa + ")");
  }
}

console.log(
  "node-forge-audit-exception=PASS ghsa=" +
    GHSA +
    " review_after=" +
    REVIEW_AFTER,
);
