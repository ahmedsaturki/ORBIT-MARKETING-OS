import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { promisify } from "node:util";
import { tmpdir } from "node:os";

const execFileAsync = promisify(execFile);
const scriptPath = new URL("./vercel-ignore.sh", import.meta.url);

async function git(cwd, args) {
  return execFileAsync("git", args, { cwd });
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

test("vercel ignore script declares a fail-closed main deployment contract", async () => {
  const script = await readFile(scriptPath, "utf8");

  assert.match(script, /VERCEL_GIT_COMMIT_REF/);
  assert.match(script, /VERCEL_GIT_PREVIOUS_SHA/);
  assert.match(script, /VERCEL_GIT_COMMIT_SHA/);
  assert.match(
    script,
    /only permits Vercel Git builds from the protected main branch/,
  );
  assert.match(
    script,
    /main is fail-closed for deployment filtering/,
  );
  assert.match(script, /protected main is always deployable/);
  assert.match(script, /exit 0/);
  assert.match(script, /exit 1/);
});

test("main always builds while non-main branches stay skipped", async () => {
  const cwd = await mkdtemp(tmpdir() + "/orbit-vercel-ignore-");

  try {
    await git(cwd, ["init", "-q"]);
    await git(cwd, ["config", "user.email", "orbit-test@example.invalid"]);
    await git(cwd, ["config", "user.name", "ORBIT Test"]);

    await execFileAsync(
      "bash",
      [
        "-lc",
        'printf "base" > README.md && git add README.md && git commit -qm base',
      ],
      { cwd },
    );

    const previous = (await git(cwd, ["rev-parse", "HEAD"])).stdout.trim();

    await execFileAsync(
      "bash",
      [
        "-lc",
        'printf "next" > README.md && git add README.md && git commit -qm next',
      ],
      { cwd },
    );

    const current = (await git(cwd, ["rev-parse", "HEAD"])).stdout.trim();

    assert.equal(
      await runIgnore(cwd, {
        VERCEL_GIT_COMMIT_REF: "main",
        VERCEL_GIT_PREVIOUS_SHA: previous,
        VERCEL_GIT_COMMIT_SHA: current,
      }),
      1,
      "main must always request a Vercel deployment",
    );

    assert.equal(
      await runIgnore(cwd, {
        VERCEL_GIT_COMMIT_REF: "feature/example",
        VERCEL_GIT_PREVIOUS_SHA: previous,
        VERCEL_GIT_COMMIT_SHA: current,
      }),
      0,
      "non-main branches must remain skipped",
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("main builds when Git revision context is incomplete or unavailable", async () => {
  const cwd = await mkdtemp(tmpdir() + "/orbit-vercel-ignore-missing-");

  try {
    await git(cwd, ["init", "-q"]);

    assert.equal(
      await runIgnore(cwd, { VERCEL_GIT_COMMIT_REF: "main" }),
      1,
    );

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
