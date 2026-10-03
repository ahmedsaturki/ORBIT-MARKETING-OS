import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("root package pins the intended package manager", async () => {
  const pkg = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  assert.equal(pkg.packageManager, "pnpm@10.17.1");
  assert.equal(typeof pkg.scripts["verify:workspace"], "string");

  // The workflow pin gate must cover the four release-adjacent workflows added
  // to workflowFiles[] in the governance change; this is the bite.
  const verifyWorkspace = await readFile(
    new URL("./verify-workspace.mjs", import.meta.url),
    "utf8",
  );
  for (const workflow of [
    "commercial-release.yml",
    "commercial-connector-proof.yml",
    "release-evidence.yml",
    "vercel-production-provenance.yml",
  ]) {
    assert.ok(
      verifyWorkspace.includes(`.github/workflows/${workflow}`),
      `verify-workspace.mjs must gate ${workflow} for action pinning`,
    );
  }
});
