import test from "node:test";
import assert from "node:assert/strict";
import {
  commit,
  execFileAsync,
  initGitFixture,
  writeReleaseMarker,
} from "./test-git-fixture.mjs";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const scriptPath = new URL("./vercel-ignore.sh", import.meta.url);

async function runIgnore(cwd, env = { VERCEL_GIT_COMMIT_REF: "main" }) {
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
  assert.match(script, /HEAD\^ HEAD/);
  assert.match(script, /PRODUCTION_RELEASE\.json/);
  assert.match(script, /releaseId/);
  assert.match(script, /bootstrap/);
  assert.match(
    script,
    /last successful deployment, not necessarily the previous Git commit/,
  );
  assert.match(script, /exit 0/);
  assert.match(script, /exit 1/);
});

test("only the commit that changes the release marker can trigger a build", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "orbit-vercel-ignore-"));
  try {
    await initGitFixture(cwd, {
      releaseId: "bootstrap",
      notes: "base",
    });
    await mkdir(join(cwd, "packages", "web"), { recursive: true });
    await writeFile(join(cwd, "packages/web/index.html"), "v1\n", "utf8");
    await commit(cwd);
    assert.equal(await runIgnore(cwd), 0);

    await writeFile(
      join(cwd, "packages/web/index.html"),
      "ordinary web change\n",
      "utf8",
    );
    await commit(cwd);
    assert.equal(await runIgnore(cwd), 0);

    await writeReleaseMarker(cwd, "bootstrap", "bootstrap rewrite");
    await commit(cwd);
    assert.equal(await runIgnore(cwd), 0);

    await writeReleaseMarker(cwd, "2026-09-28-r1");
    await commit(cwd);
    assert.equal(await runIgnore(cwd), 1);

    await writeFile(join(cwd, "README.md"), "post-release docs\n", "utf8");
    await commit(cwd);
    assert.equal(
      await runIgnore(cwd, {
        VERCEL_GIT_COMMIT_REF: "main",
        VERCEL_GIT_PREVIOUS_SHA: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        VERCEL_GIT_COMMIT_SHA: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      }),
      0,
    );

    assert.equal(
      await runIgnore(cwd, {
        VERCEL_GIT_COMMIT_REF: "feature/example",
      }),
      0,
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("vercel ignore builds when the current commit has no parent", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "orbit-vercel-ignore-root-"));
  try {
    await execFileAsync("git", ["init", "-q"], { cwd });
    await writeFile(join(cwd, "README.md"), "root\n", "utf8");
    await execFileAsync("git", ["add", "."], { cwd });
    await execFileAsync(
      "git",
      ["-c", "user.email=orbit-test@example.invalid", "-c", "user.name=ORBIT Test", "commit", "-qm", "root"],
      { cwd },
    );
    assert.equal(await runIgnore(cwd), 1);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
