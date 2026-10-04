/**
 * Governance contract for GHSA-vfj7-8cjw-p6xm (braces).
 *
 * This advisory is ignored by `pnpm audit`, which is only defensible while the
 * following are all true. Each is asserted here rather than asserted in prose,
 * so that any one of them ceasing to hold fails CI:
 *
 *  1. The advisory is still the only ignored entry besides the node-forge
 *     exception, so this contract cannot silently widen the allowlist.
 *  2. The installed version is the newest one published. If upstream ships a
 *     fix, the correct response is to upgrade, not to keep ignoring.
 *  3. The dependency is reached only through build-time bundler tooling, never
 *     through a shipped runtime dependency.
 *  4. The exception carries a review date and expires hard after it.
 *
 * The vulnerability is stack exhaustion in glob pattern compilation. The
 * exposed surface is therefore code that compiles globs; in this repository
 * that is the Expo/Metro bundler under packages/mobile, running at build time
 * over repository-controlled patterns.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const GHSA = "GHSA-vfj7-8cjw-p6xm";
const REVIEW_AFTER = "2026-11-03";
const MAX_INSTALLED_VERSION = "3.0.3";
const PACKAGE = "braces";
const require = createRequire(import.meta.url);

const workspace = readFileSync("pnpm-workspace.yaml", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

// (1) The allowlist is exactly the two governed advisories.
const ignoreMatch = workspace.match(
  /auditConfig:\s*\n\s*ignoreGhsas:\s*\n((?:\s+-\s+[^\n]+\n?)+)/,
);
assert(ignoreMatch, "governance exception configuration is missing");
const ignored = ignoreMatch[1]
  .split("\n")
  .map((line) => line.trim().replace(/^-\s+/, "").trim())
  .filter(Boolean);
assert.deepEqual(
  ignored,
  ["GHSA-86w9-cpqp-85rv", GHSA],
  "the audit allowlist must contain exactly the two governed advisories",
);
assert.match(
  workspace,
  new RegExp(`# ${GHSA} \\(braces\\)`),
  "the exception must carry a written justification in the workspace file",
);

// (2) The installed version is the latest published. If this fails, upgrade
// instead of ignoring.
const lockfile = readFileSync("pnpm-lock.yaml", "utf8");
assert.match(lockfile, /braces@3\.0\.3/, "braces is expected in the lockfile");

// (2) The pinned version really is the newest published.
//
// This used to read `const latest = MAX_INSTALLED_VERSION` and then assert the
// lockfile contained that same constant, which compares a value with itself
// and can never fail: a newer braces release, or a second braces version in the
// lockfile, both passed. The advisory's upgrade trigger is therefore unenforced.
// The registry is consulted directly, and the check fails closed if it cannot
// be reached rather than passing silently.
const registryResponse = await fetch(`https://registry.npmjs.org/${PACKAGE}`);
assert.ok(
  registryResponse.ok,
  `npm registry must be reachable to verify ${PACKAGE} (got ${registryResponse.status})`,
);
const { ["dist-tags"]: distTags } = await registryResponse.json();
assert.equal(
  distTags.latest,
  MAX_INSTALLED_VERSION,
  `${PACKAGE} is pinned at ${MAX_INSTALLED_VERSION} but the registry reports ${distTags.latest} as latest; review whether to upgrade`,
);

// (3) Reachability is build-time only: braces is reached through Metro
// bundler tooling, which never ships in a runtime artifact.
const shippedPackages = ["packages/mobile", "packages/desktop", "packages/web"];
for (const packagePath of shippedPackages) {
  const manifest = JSON.parse(
    readFileSync(`${packagePath}/package.json`, "utf8"),
  );
  // peerDependencies counts too: a peer dependency is installed into a shipped
  // package's tree rather than staying confined to the tool that wanted it, so
  // it would invalidate the "build-time only" premise this exception rests on.
  for (const field of [
    "dependencies",
    "optionalDependencies",
    "peerDependencies",
  ]) {
    const declared = Object.keys(manifest[field] ?? {});
    assert.ok(
      !declared.includes("braces"),
      `${packagePath} declares braces as a ${field} entry; the exception ` +
        "assumes it is build-time only",
    );
  }
}

// (4) The review date is valid and the exception expires hard after it.
assert.equal(
  packageJson.packageManager,
  "pnpm@10.17.1",
  "exception contract is tied to the repository's pinned package manager",
);
// The exception is valid *through* the review date and fails after it, which is
// what docs/SECURITY_EXCEPTIONS.md states in both places. Comparing against
// REVIEW_AFTER at 00:00 UTC expired the exception a full day early, on the
// morning the review was still due. Compare against the start of the next day.
const reviewDate = new Date(REVIEW_AFTER + "T00:00:00Z");
const expiryDate = new Date(reviewDate.valueOf() + 24 * 60 * 60 * 1000);
if (Number.isNaN(reviewDate.valueOf())) {
  throw new Error("invalid review date");
}
if (Date.now() >= expiryDate.valueOf()) {
  throw new Error(
    `${GHSA} exception expired after ${REVIEW_AFTER}: re-review and either ` +
      "upgrade braces or record a new justification",
  );
}
console.log(
  `braces-audit-exception=PASS ghsa=${GHSA} version=${MAX_INSTALLED_VERSION} ` +
    `review_after=${REVIEW_AFTER}`,
);
