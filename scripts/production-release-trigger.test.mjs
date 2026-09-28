import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const execFileAsync = promisify(execFile);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const RESOLVER = join(ROOT, "scripts", "resolve-production-release.mjs");

async function git(cwd, args) {
  await execFileAsync("git", args, { cwd });
}

async function sha(cwd) {
  return (await execFileAsync("git", ["rev-parse", "HEAD"], { cwd })).stdout.trim();
}

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
    await git(cwd, ["init", "-q"]);
    await git(cwd, ["config", "user.email", "orbit-test@example.invalid"]);
    await git(cwd, ["config", "user.name", "ORBIT Test"]);
    await execFileAsync("bash", ["-lc", "mkdir -p scripts release"], { cwd });
    await cp(RESOLVER, join(cwd, "scripts", "resolve-production-release.mjs"));
    await writeFile(
      join(cwd, "release", "PRODUCTION_RELEASE.json"),
      JSON.stringify({
        schemaVersion: 1,
        releaseId: "bootstrap",
        mode: "EXPLICIT_PRODUCTION_RELEASE",
      }) + "\n",
      "utf8",
    );
    await git(cwd, ["add", "."]);
    await git(cwd, ["commit", "-qm", "bootstrap"]);

    let current = await sha(cwd);
    let result = await state(cwd);
    assert.equal(result.release_id, "bootstrap");
    assert.equal(result.release_sha, current);
    assert.equal(result.release_active, "false");
    assert.equal(result.release_current, "false");

    await writeFile(join(cwd, "README.md"), "ordinary docs\n", "utf8");
    await git(cwd, ["add", "."]);
    await git(cwd, ["commit", "-qm", "docs"]);
    current = await sha(cwd);
    result = await state(cwd);
    assert.equal(result.release_sha, (await execFileAsync(
      "git",
      ["log", "-1", "--format=%H", "--", "release/PRODUCTION_RELEASE.json"],
      { cwd },
    )).stdout.trim());
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
    await git(cwd, ["add", "."]);
    await git(cwd, ["commit", "-qm", "production release"]);
    current = await sha(cwd);
    result = await state(cwd);
    assert.equal(result.release_id, "2026-09-28-r1");
    assert.equal(result.release_sha, current);
    assert.equal(result.current_sha, current);
    assert.equal(result.release_active, "true");
    assert.equal(result.release_current, "true");

    await writeFile(join(cwd, "README.md"), "post-release docs\n", "utf8");
    await git(cwd, ["add", "."]);
    await git(cwd, ["commit", "-qm", "post-release docs"]);
    current = await sha(cwd);
    result = await state(cwd);
    assert.notEqual(result.release_sha, current);
    assert.equal(result.release_current, "false");
    assert.equal(result.release_active, "true");
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
