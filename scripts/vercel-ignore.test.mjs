import test from "node:test";
import assert from "node:assert/strict";
import {
  commitSha,
  execFileAsync,
  git,
  initGitFixture,
} from "./test-git-fixture.mjs";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const scriptPath = new URL("./vercel-ignore.sh", import.meta.url);
const MARKER_PATH = "release/PRODUCTION_RELEASE.json";

async function runIgnore(cwd, env) {
  try {
    await execFileAsync("bash", [scriptPath.pathname], {
      cwd,
      env: { ...process.env, ...env },
    });
    return 0;
  } catch (error) {
    return error.code ?? 1;
  }
}

test("vercel ignore script exposes the explicit production release contract", async () => {
  const script = await readFile(scriptPath, "utf8");
  assert.match(script, /VERCEL_GIT_COMMIT_REF/);
  assert.match(script, /VERCEL_GIT_PREVIOUS_SHA/);
  assert.match(script, /VERCEL_GIT_COMMIT_SHA/);
  assert.match(script, /PRODUCTION_RELEASE\.json/);
  assert.match(script, /releaseId/);
  assert.match(script, /bootstrap/);
  assert.match(
    script,
    /only permits Vercel Git builds from the protected main branch/,
  );
  assert.match(script, /exit 0/);
  assert.match(script, /exit 1/);
});

test("ordinary web/docs commits are skipped; only a non-bootstrap marker change builds", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "orbit-vercel-ignore-"));
  try {
    await initGitFixture(cwd, {
      schemaVersion: 1,
      releaseId: "bootstrap",
      mode: "EXPLICIT_PRODUCTION_RELEASE",
      notes: "bootstrap base",
    });
    await mkdir(join(cwd, "packages", "web"), { recursive: true });
    await writeFile(join(cwd, "packages/web/index.html"), "v1\n", "utf8");
    await git(cwd, ["add", "."]);
    await git(cwd, ["commit", "-qm", "base"]);
    let previous = await commitSha(cwd);

    await writeFile(
      join(cwd, "packages/web/index.html"),
      "ordinary web change\n",
      "utf8",
    );
    await git(cwd, ["add", "."]);
    await git(cwd, ["commit", "-qm", "ordinary web"]);
    let current = await commitSha(cwd);
    assert.equal(
      await runIgnore(join(cwd, "packages", "web"), {
        VERCEL_GIT_COMMIT_REF: "main",
        VERCEL_GIT_PREVIOUS_SHA: previous,
        VERCEL_GIT_COMMIT_SHA: current,
      }),
      0,
    );

    previous = current;
    await writeFile(
      join(cwd, MARKER_PATH),
      JSON.stringify({
        schemaVersion: 1,
        releaseId: "bootstrap",
        mode: "EXPLICIT_PRODUCTION_RELEASE",
        notes: "bootstrap rewrite",
      }) + "\n",
      "utf8",
    );
    await git(cwd, ["add", "."]);
    await git(cwd, ["commit", "-qm", "bootstrap marker rewrite"]);
    current = await commitSha(cwd);
    assert.equal(
      await runIgnore(join(cwd, "packages", "web"), {
        VERCEL_GIT_COMMIT_REF: "main",
        VERCEL_GIT_PREVIOUS_SHA: previous,
        VERCEL_GIT_COMMIT_SHA: current,
      }),
      0,
    );

    previous = current;
    await writeFile(
      join(cwd, MARKER_PATH),
      JSON.stringify({
        schemaVersion: 1,
        releaseId: "2026-09-28-r1",
        mode: "EXPLICIT_PRODUCTION_RELEASE",
      }) + "\n",
      "utf8",
    );
    await git(cwd, ["add", "."]);
    await git(cwd, ["commit", "-qm", "production release r1"]);
    current = await commitSha(cwd);
    assert.equal(
      await runIgnore(join(cwd, "packages", "web"), {
        VERCEL_GIT_COMMIT_REF: "main",
        VERCEL_GIT_PREVIOUS_SHA: previous,
        VERCEL_GIT_COMMIT_SHA: current,
      }),
      1,
    );

    previous = current;
    await writeFile(join(cwd, "README.md"), "post-release docs\n", "utf8");
    await git(cwd, ["add", "."]);
    await git(cwd, ["commit", "-qm", "post-release docs"]);
    current = await commitSha(cwd);
    assert.equal(
      await runIgnore(join(cwd, "packages", "web"), {
        VERCEL_GIT_COMMIT_REF: "main",
        VERCEL_GIT_PREVIOUS_SHA: previous,
        VERCEL_GIT_COMMIT_SHA: current,
      }),
      0,
    );

    assert.equal(
      await runIgnore(join(cwd, "packages", "web"), {
        VERCEL_GIT_COMMIT_REF: "feature/example",
        VERCEL_GIT_PREVIOUS_SHA: previous,
        VERCEL_GIT_COMMIT_SHA: current,
      }),
      0,
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("vercel ignore builds when Git revision context is incomplete or unavailable", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "orbit-vercel-ignore-missing-"));
  try {
    await git(cwd, ["init", "-q"]);
    assert.equal(await runIgnore(cwd, { VERCEL_GIT_COMMIT_REF: "main" }), 1);
    assert.equal(
      await runIgnore(cwd, {
        VERCEL_GIT_COMMIT_REF: "main",
        VERCEL_GIT_PREVIOUS_SHA: "missing",
        VERCEL_GIT_COMMIT_SHA: "missing",
      }),
      1,
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
