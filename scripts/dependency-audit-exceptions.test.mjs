import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import braces from "braces";

const EXCEPTIONS = [
  {
    ghsa: "GHSA-86w9-cpqp-85rv",
    packageName: "node-forge",
    packageVersion: "1.4.0",
    patchPath: "patches/node-forge@1.4.0.patch",
    patchHash:
      "1da5306df32cb00fb9309034ffcd35c1126ccd13ce79f5f0031825ad79bbab27",
    regressionPath: "packages/mobile/test/nodeForgeDigestInfo.test.ts",
  },
  {
    ghsa: "GHSA-vfj7-8cjw-p6xm",
    packageName: "braces",
    packageVersion: "3.0.3",
    patchPath: "patches/braces@3.0.3.patch",
    patchHash:
      "f7b8577c6aa409a18d650762cce9bae178d30e4c9dbacf017b9fa94e46f788d1",
  },
];

const REVIEW_AFTER = "2026-11-03";
const workspace = readFileSync("pnpm-workspace.yaml", "utf8");
const lockfile = readFileSync("pnpm-lock.yaml", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

const ignoreMatch = workspace.match(
  /auditConfig:\s*\n\s*ignoreGhsas:\s*\n((?:\s+-\s+[^\n]+\n?)+)/,
);
assert(ignoreMatch, "governed audit exception configuration is missing");

const ignoredGhsas = ignoreMatch[1]
  .split("\n")
  .map((line) => line.trim().replace(/^-\s+/, "").trim())
  .filter(Boolean);

assert.deepEqual(
  ignoredGhsas,
  EXCEPTIONS.map((item) => item.ghsa),
  "audit exception list must contain exactly the reviewed advisories",
);

assert.equal(
  packageJson.packageManager,
  "pnpm@10.17.1",
  "exception contract is tied to the pinned package manager",
);
assert.equal(
  packageJson.devDependencies.braces,
  "3.0.3",
  "braces regression coverage must use the reviewed package version",
);

for (const item of EXCEPTIONS) {
  assert.match(
    workspace,
    new RegExp(
      `patchedDependencies:\\s*\\n\\s*${item.packageName.replace("-", "\\-")}@${item.packageVersion.replace(".", "\\.")}:\\s*${item.patchPath.replaceAll("/", "\\/")}`,
    ),
    `${item.packageName} must be wired through patchedDependencies`,
  );

  const lockMatch = lockfile.match(
    new RegExp(
      `patchedDependencies:\\s*[\\s\\S]*?\\s+${item.packageName.replace("-", "\\-")}@${item.packageVersion.replace(".", "\\.")}:\\s*\\n\\s+hash:\\s+([^\\n]+)\\s+path:\\s+${item.patchPath.replaceAll("/", "\\/")}`,
    ),
  );
  assert(lockMatch, `${item.packageName} patch must be pinned in the lockfile`);
  assert.equal(
    lockMatch[1].trim(),
    item.patchHash,
    `${item.packageName} lockfile patch hash must match the reviewed artifact`,
  );

  assert(existsSync(item.patchPath), `${item.packageName} patch file is missing`);
  const patch = readFileSync(item.patchPath, "utf8");
  assert(patch.length > 0, `${item.packageName} patch file is empty`);
  assert.equal(
    createHash("sha256").update(patch).digest("hex"),
    item.patchHash,
    `${item.packageName} patch artifact hash mismatch`,
  );

  if (item.regressionPath) {
    const regression = readFileSync(item.regressionPath, "utf8");
    assert.match(
      regression,
      new RegExp(item.ghsa),
      `${item.packageName} regression must identify its approved GHSA`,
    );
  }
}

const nodeForgeRegression = readFileSync(
  "packages/mobile/test/nodeForgeDigestInfo.test.ts",
  "utf8",
);
assert.match(
  nodeForgeRegression,
  /nested DigestAlgorithm/i,
  "node-forge regression must exercise nested DigestAlgorithm",
);
assert.match(
  nodeForgeRegression,
  /assert\.throws/,
  "node-forge regression must reject the forged signature",
);

assert.throws(
  () => braces("{" .repeat(101) + "a" + "}" .repeat(101)),
  /exceeds max depth/,
  "braces must reject deeply nested attacker-controlled input",
);
assert.doesNotThrow(
  () => braces.parse("{{a,b},c}", { maxDepth: 2 }),
  "braces must preserve supported shallower nesting",
);
assert.throws(
  () => braces.parse("{{a,b},c}", { maxDepth: 1 }),
  /exceeds max depth/,
  "braces maxDepth option must remain enforceable",
);

const reviewDate = new Date(REVIEW_AFTER + "T00:00:00Z");
if (Number.isNaN(reviewDate.valueOf())) {
  throw new Error("invalid dependency-audit exception review date");
}
if (Date.now() >= reviewDate.valueOf()) {
  throw new Error(
    "dependency-audit exception review date reached: " + REVIEW_AFTER,
  );
}

console.log(
  "dependency-audit-exceptions=PASS advisories=" +
    EXCEPTIONS.map((item) => item.ghsa).join(",") +
    " review_after=" +
    REVIEW_AFTER,
);
