import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { join } from "node:path";
import { tmpdir } from "node:os";

const execFileAsync = promisify(execFile);
const scriptPath = new URL("./vercel-ignore.sh", import.meta.url);
const MARKER_PATH = "release/PRODUCTION_RELEASE.json";

async function git(cwd, args) {
  await execFileAsync("git", args, { cwd });
}

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
  assert.match(script, /only permits Vercel Git builds from the protected main branch/);
  assert.match(script, /exit 0/);
  assert.match(script, /exit 1/);
});

test("only a non-bootstrap production release marker change triggers a Vercel build", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "orbit-vercel-ignore-"));
  try {
    await git(cwd, ["init", "-q"]);
    await git(cwd, ["config", "user.email", "orbit-test@example.invalid"]);
    await git(cwd, ["config", "user.name", "ORBIT Test"]);
    await execFileAsync("bash", [
      "-lc",
      'mkdir -p packages/web release && printf "v1" > packages/web/index.html && printf '{"schemaVersion":1,"releaseId":"bootstrap","mode":"EXPLICIT_PRODUCTION_RELEASE"}\n' > release/PRODUCTION_RELEASE.json',
    ], { cwd });
    await git(cwd, ["add", "."]);
    await git(cwd, ["commit", "-qm", "base"]);
    let previous = (await execFileAsync("git", ["rev-parse", "HEAD"], { cwd })).stdout.trim();

    await writeFile(join(cwd, "packages/web/index.html"), "ordinary web change\n", "utf8");
    await git(cwd, ["add", "."]);
    await git(cwd, ["commit", "-qm", "web"]);
    let current = (await execFileAsync("git", ["rev-parse", "HEAD"], { cwd })).stdout.trim();
    assert.equal(await runIgnore(join(cwd, "packages", "web"), {
      VERCEL_GIT_COMMIT_REF: "main",
      VERCEL_GIT_PREVIOUS_SHA: previous,
      VERCEL_GIT_COMMIT_SHA: current,
    }), 0);

    previous = current;
    await writeFile(join(cwd, MARKER_PATH), '{"schemaVersion":1,"releaseId":"bootstrap","mode":"EXPLICIT_PRODUCTION_RELEASE"}\n', "utf8");
    await git(cwd, ["add", "."]);
    await git(cwd, ["commit", "-qm", "bootstrap marker rewrite"]);
    current = (await execFileAsync("git", ["rev-parse", "HEAD"], { cwd })).stdout.trim();
    assert.equal(await runIgnore(join(cwd, "packages", "web"), {
      VERCEL_GIT_COMMIT_REF: "main",
      VERCEL_GIT_PREVIOUS_SHA: previous,
      VERCEL_GIT_COMMIT_SHA: current,
    }), 0);

    previous = current;
    await writeFile(join(cwd, MARKER_PATH), '{"schemaVersion":1,"releaseId":"2026-09-28-r1","mode":"EXPLICIT_PRODUCTION_RELEASE"}\n', "utf8");
    await git(cwd, ["add", "."]);
    await git(cwd, ["commit", "-qm", "release"]);
    current = (await execFileAsync("git", ["rev-parse", "HEAD"], { cwd })).stdout.trim();
    assert.equal(await runIgnore(join(cwd, "packages", "web"), {
      VERCEL_GIT_COMMIT_REF: "main",
      VERCEL_GIT_PREVIOUS_SHA: previous,
      VERCEL_GIT_COMMIT_SHA: current,
    }), 1);

    previous = current;
    await writeFile(join(cwd, "README.md"), "post release docs\n", "utf8");
    await git(cwd, ["add", "."]);
    await git(cwd, ["commit", "-qm", "post-release docs"]);
    current = (await execFileAsync("git", ["rev-parse", "HEAD"], { cwd })).stdout.trim();
    assert.equal(await runIgnore(join(cwd, "packages", "web"), {
      VERCEL_GIT_COMMIT_REF: "main",
      VERCEL_GIT_PREVIOUS_SHA: previous,
      VERCEL_GIT_COMMIT_SHA: current,
    }), 0);

    assert.equal(await runIgnore(join(cwd, "packages", "web"), {
      VERCEL_GIT_COMMIT_REF: "feature/example",
      VERCEL_GIT_PREVIOUS_SHA: previous,
      VERCEL_GIT_COMMIT_SHA: current,
    }), 0);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("vercel ignore builds when Git revision context is incomplete or unavailable", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "orbit-vercel-ignore-missing-"));
  try {
    await git(cwd, ["init", "-q"]);
    assert.equal(await runIgnore(cwd, { VERCEL_GIT_COMMIT_REF: "main" }), 1);
    assert.equal(await runIgnore(cwd, {
      VERCEL_GIT_COMMIT_REF: "main",
      VERCEL_GIT_PREVIOUS_SHA: "missing",
      VERCEL_GIT_COMMIT_SHA: "missing",
    }), 1);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
