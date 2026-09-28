import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import {
  commit,
  commitSha,
  execFileAsync,
  initGitFixture,
  writeReleaseMarker,
} from "./test-git-fixture.mjs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const RESOLVER = join(
  dirname(fileURLToPath(import.meta.url)),
  "resolve-production-release.mjs",
);

async function state(cwd) {
  const { stdout } = await execFileAsync(
    process.execPath,
    [join(cwd, "scripts", "resolve-production-release.mjs")],
    { cwd },
  );
  return Object.fromEntries(
    stdout
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => line.split("=")),
  );
}

test("production release resolver binds the release to the marker commit", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "orbit-production-release-"));
  try {
    await initGitFixture(cwd, {
      releaseId: "bootstrap",
    });
    await cp(RESOLVER, join(cwd, "scripts", "resolve-production-release.mjs"));
    await commit(cwd, "bootstrap");

    let current = await commitSha(cwd);
    let result = await state(cwd);
    assert.equal(result.release_id, "bootstrap");
    assert.equal(result.release_sha, current);
    assert.equal(result.release_active, "false");
    assert.equal(result.release_current, "false");

    await writeFile(join(cwd, "README.md"), "ordinary docs\n", "utf8");
    current = await commit(cwd);
    result = await state(cwd);
    assert.notEqual(result.release_sha, current);
    assert.equal(result.release_current, "false");

    await writeFile(
      join(cwd, "release", "PRODUCTION_RELEASE.json"),
      JSON.stringify({
        schemaVersion: 1,
        releaseId: "2026-09-28-r1",
        mode: "EXPLICIT_PRODUCTION_RELEASE",
      }) + "\n",
      "utf8",
    );
    current = await commit(cwd);
    result = await state(cwd);
    assert.equal(result.release_id, "2026-09-28-r1");
    assert.equal(result.release_sha, current);
    assert.equal(result.current_sha, current);
    assert.equal(result.release_active, "true");
    assert.equal(result.release_current, "true");

    await writeFile(join(cwd, "README.md"), "post-release docs\n", "utf8");
    current = await commit(cwd);
    result = await state(cwd);
    assert.notEqual(result.release_sha, current);
    assert.equal(result.release_current, "false");
    assert.equal(result.release_active, "true");
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
