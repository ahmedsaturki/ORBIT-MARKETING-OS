import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { join } from "node:path";
import { tmpdir } from "node:os";

const execFileAsync = promisify(execFile);
const scriptPath = new URL("./vercel-ignore.sh", import.meta.url);

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

test("vercel ignore script declares the release-truth deployment contract", async () => {
  const script = await readFile(scriptPath, "utf8");

  assert.match(script, /VERCEL_GIT_COMMIT_REF/);
  assert.match(script, /VERCEL_GIT_PREVIOUS_SHA/);
  assert.match(script, /VERCEL_GIT_COMMIT_SHA/);
  assert.match(
    script,
    /only permits Vercel Git builds from the protected main branch/,
  );
  assert.match(script, /packages\/web/);
  assert.match(script, /release/);
  assert.match(script, /docs\/RELEASE_\*\.md/);
  assert.match(script, /docs\/LAUNCH_SCORECARD\.md/);
  assert.match(script, /docs\/PERFORMANCE_EVIDENCE\.md/);
  assert.match(script, /docs\/COMMERCIAL_PRODUCTION_PROVEN_RUNBOOK\.md/);
  assert.match(script, /docs\/VERIFICATION_BLOCKERS\.md/);
  assert.match(script, /scripts\/vercel-ignore\.sh/);
  assert.match(script, /scripts\/vercel-install\.sh/);
  assert.match(script, /git rev-parse --show-toplevel/);
  assert.match(script, /exit 0/);
  assert.match(script, /exit 1/);
});

test("main branch skips unrelated documentation but builds for release-truth changes from a nested root directory", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "orbit-vercel-ignore-"));

  try {
    await git(cwd, ["init", "-q"]);
    await git(cwd, ["config", "user.email", "orbit-test@example.invalid"]);
    await git(cwd, ["config", "user.name", "ORBIT Test"]);

    await execFileAsync(
      "bash",
      [
        "-lc",
        'mkdir -p packages/web release docs && printf "v1" > packages/web/index.html && printf "{}" > release/readiness.json && printf "base" > docs/README.md',
      ],
      { cwd },
    );
    await git(cwd, ["add", "."]);
    await git(cwd, ["commit", "-qm", "base"]);
    const previous = (
      await execFileAsync("git", ["rev-parse", "HEAD"], { cwd })
    ).stdout.trim();

    await writeFile(join(cwd, "docs", "README.md"), "unrelated docs");
    await git(cwd, ["add", "."]);
    await git(cwd, ["commit", "-qm", "docs"]);
    const docsCommit = (
      await execFileAsync("git", ["rev-parse", "HEAD"], { cwd })
    ).stdout.trim();

    const webRoot = join(cwd, "packages", "web");
    assert.equal(
      await runIgnore(webRoot, {
        VERCEL_GIT_COMMIT_REF: "main",
        VERCEL_GIT_PREVIOUS_SHA: previous,
        VERCEL_GIT_COMMIT_SHA: docsCommit,
      }),
      0,
      "unrelated documentation should remain skippable from a nested root",
    );

    const assertBuildRequired = async (relativePath, content, label) => {
      await writeFile(join(cwd, relativePath), content);
      await git(cwd, ["add", "."]);
      await git(cwd, ["commit", "-qm", label]);
      const current = (
        await execFileAsync("git", ["rev-parse", "HEAD"], { cwd })
      ).stdout.trim();

      assert.equal(
        await runIgnore(webRoot, {
          VERCEL_GIT_COMMIT_REF: "main",
          VERCEL_GIT_PREVIOUS_SHA: previous,
          VERCEL_GIT_COMMIT_SHA: current,
        }),
        1,
        label + " changes must force a Vercel deployment from a nested root",
      );
    };

    const releaseCommit = await assertBuildRequired(
      previous,
      "release/readiness.json",
      '{ "updated": "2026-09-28" }\n',
      "release-truth",
    );

    const scorecardCommit = await assertBuildRequired(
      releaseCommit,
      "docs/RELEASE_SCORECARD.md",
      "release scorecard",
      "release-scorecard",
    );

    const evidenceCommit = await assertBuildRequired(
      scorecardCommit,
      "docs/RELEASE_EVIDENCE_2026-09-28.md",
      "release evidence",
      "release-evidence",
    );

    const performanceCommit = await assertBuildRequired(
      evidenceCommit,
      "docs/PERFORMANCE_EVIDENCE.md",
      "performance evidence",
      "performance-evidence",
    );

    assert.equal(
      await runIgnore(webRoot, {
        VERCEL_GIT_COMMIT_REF: "feature/example",
        VERCEL_GIT_PREVIOUS_SHA: docsCommit,
        VERCEL_GIT_COMMIT_SHA: performanceCommit,
      }),
      0,
      "non-main branches must never deploy",
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("vercel ignore script builds when Git revision context is incomplete or unavailable", async () => {
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
