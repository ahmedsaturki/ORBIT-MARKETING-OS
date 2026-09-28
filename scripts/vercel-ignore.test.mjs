import test from "node:test";
import assert from "node:assert/strict";
import {
  commit,
  execFileAsync,
  git,
  initGitFixture,
  writeReleaseMarker,
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
      releaseId: "bootstrap",
      notes: "bootstrap base",
    });
    await mkdir(join(cwd, "packages", "web"), { recursive: true });
    await writeFile(join(cwd, "packages/web/index.html"), "v1\n", "utf8");
    let previous = await commit(cwd, "base");

    await writeFile(
      join(cwd, "packages/web/index.html"),
      "ordinary web change\n",
      "utf8",
    );
    let current = await commit(cwd, "ordinary web");
    assert.equal(
      await runIgnore(join(cwd, "packages", "web"), {
        VERCEL_GIT_COMMIT_REF: "main",
        VERCEL_GIT_PREVIOUS_SHA: previous,
        VERCEL_GIT_COMMIT_SHA: current,
      }),
      0,
    );

    previous = current;
    await writeReleaseMarker(cwd, "bootstrap", "bootstrap rewrite");
    current = await commit(cwd, "bootstrap marker rewrite");
    assert.equal(
      await runIgnore(join(cwd, "packages", "web"), {
        VERCEL_GIT_COMMIT_REF: "main",
        VERCEL_GIT_PREVIOUS_SHA: previous,
        VERCEL_GIT_COMMIT_SHA: current,
      }),
      0,
    );

    previous = current;
    await writeReleaseMarker(cwd, "2026-09-28-r1");
    current = await commit(cwd, "production release r1");
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
    current = await commit(cwd, "post-release docs");
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

test("vercel ignore rejects malformed Git revision values", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "orbit-vercel-ignore-malformed-"));
  try {
    assert.equal(
      await runIgnore(cwd, {
        VERCEL_GIT_COMMIT_REF: "main",
        VERCEL_GIT_PREVIOUS_SHA: "--upload-pack=evil",
        VERCEL_GIT_COMMIT_SHA: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      }),
      1,
    );
    assert.equal(
      await runIgnore(cwd, {
        VERCEL_GIT_COMMIT_REF: "main",
        VERCEL_GIT_PREVIOUS_SHA: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        VERCEL_GIT_COMMIT_SHA: "HEAD",
      }),
      1,
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
