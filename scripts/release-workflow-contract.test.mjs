import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WORKFLOW_DIR = join(ROOT, ".github", "workflows");

async function workflowFiles() {
  const files = (await readdir(WORKFLOW_DIR)).filter((f) => /\.ya?ml$/.test(f));
  assert.ok(files.length > 0, "no workflow files found");
  return files;
}

async function text(file) {
  return (await readFile(join(WORKFLOW_DIR, file))).toString("utf8");
}

// Returns each step's name paired with its `run:` command, in file order, so a
// test can assert on relative ordering rather than absolute line numbers.
async function stepList(workflow) {
  const lines = (await text(workflow)).split(/\r?\n/);
  const out = [];
  let current = null;
  lines.forEach((line, index) => {
    const named = line.match(/^\s*-\s*name:\s*(.+?)\s*$/);
    if (named) {
      current = { name: named[1], line: index + 1, run: null };
      out.push(current);
      return;
    }
    const ran = line.match(/^\s*run:\s*(.+?)\s*$/);
    if (ran && current && current.run === null) current.run = ran[1];
  });
  return out;
}

// A build step counts if it is the workspace build or the web package's own
// filter. Several workflows use `pnpm --filter @orbit/web build`, which emits
// packages/web/out just the same because next.config.mjs sets
// `output: "export"`. Matching only the literal `pnpm build` would leave those
// workflows unchecked.
const WEB_BUILD =
  /^pnpm (build|--filter @orbit\/web build|--dir packages\/web build)$/;

async function assertBuildPrecedesE2E(workflow) {
  const found = await stepList(workflow);
  const build = found.find((s) => s.run && WEB_BUILD.test(s.run));
  const e2e = found.find((s) => s.run === "pnpm test:e2e");

  assert.ok(
    build,
    `${workflow} must build the web export (pnpm build or ` +
      `pnpm --filter @orbit/web build) before running E2E`,
  );
  assert.ok(e2e, `${workflow} must run "pnpm test:e2e"`);
  assert.ok(
    build.line < e2e.line,
    `${workflow}: the web build (line ${build.line}, "${build.run}") must ` +
      `precede "pnpm test:e2e" (line ${e2e.line}); otherwise ` +
      `packages/web/out does not exist when Playwright starts its webServer`,
  );
}

test("desktop-native-validation builds the web export before running E2E", async () => {
  // This workflow runs the native E2E suite, which also serves the static web
  // surface. It builds via `pnpm --filter @orbit/web build`, so the literal
  // `pnpm build` check would not have applied.
  await assertBuildPrecedesE2E("desktop-native-validation.yml");
});

test("release quality gate builds the web export before running browser E2E", async () => {
  // The E2E suite serves packages/web/out through scripts/static-server.mjs and
  // Playwright's webServer wait has a 30s budget. Without the build the export
  // is absent and the step dies with
  // "Error: Timed out waiting 30000ms from config.webServer" — exactly how
  // release run 37205123765 failed on tag v1.0.0, blocking Build checksums
  // and Publish GitHub Release and leaving REL-03 without evidence.
  await assertBuildPrecedesE2E("release-desktop.yml");
});

test("every workflow running pnpm test:e2e builds the web export first", async () => {
  // Covers whatever workflows exist today rather than a hand-picked list, so a
  // new E2E workflow cannot skip the build. Three build forms are in use —
  // `pnpm build`, `pnpm --filter @orbit/web build` and
  // `pnpm --dir packages/web build` — and all three emit packages/web/out
  // because packages/web/next.config.mjs sets `output: "export"`.
  const files = await workflowFiles();
  let covered = 0;

  for (const file of files) {
    const found = await stepList(file);
    if (!found.some((s) => s.run === "pnpm test:e2e")) continue;

    covered++;
    const build = found.find((s) => s.run && WEB_BUILD.test(s.run));

    assert.ok(
      build,
      `${file} runs "pnpm test:e2e" but has no web export build step. The ` +
        `E2E suite serves packages/web/out, so Playwright's webServer will ` +
        `time out after 30s.`,
    );
    assert.ok(
      build.line < found.find((s) => s.run === "pnpm test:e2e").line,
      `${file} builds the web export (line ${build.line}) after ` +
        `"pnpm test:e2e" (line ${
          found.find((s) => s.run === "pnpm test:e2e").line
        }); the export does not exist yet when Playwright starts.`,
    );
  }

  assert.ok(covered >= 3, `expected several E2E workflows, found ${covered}`);
});

test("ci orders its build before web E2E, matching the release workflow", async () => {
  await assertBuildPrecedesE2E("ci.yml");
});

test("no workflow file contains a carriage return", async () => {
  // Three workflows (release-mobile, self-hosted-verify,
  // web-release-selfhosted) carried a doubled carriage return on the same
  // three-line "Governed audit exceptions" block. `\r\r\n` is not a valid YAML
  // line terminator, so GitHub reported "This run likely failed because of a
  // workflow file issue" and the workflow never executed. `.gitattributes` pins
  // `* text=auto eol=lf`, so a stray CR in the committed blob is a real defect
  // rather than a platform artefact.
  for (const file of await workflowFiles()) {
    assert.ok(
      !/\r/.test(await text(file)),
      `${file} contains a carriage return; .gitattributes requires eol=lf. ` +
        `GitHub rejects a doubled CR as an invalid YAML line terminator, so ` +
        `the workflow fails to load before any step runs.`,
    );
  }
});

test("every named workflow step is followed by a valid step key", async () => {
  // A `- name:` entry must introduce a mapping. When the next line is a blank
  // line, the entry parses as a bare scalar instead of a step and GitHub
  // rejects the entire file, so no step runs at all. Checked textually rather
  // than with a YAML parser so the test depends on nothing outside the Node
  // standard library: the `yaml` package resolves from this repo only by
  // accident of pnpm hoisting and is not a declared dependency, so it is
  // absent under CI's frozen install.
  const STEP_KEY =
    /^(run|uses|with|env|shell|if|id|continue-on-error|timeout-minutes|working-directory)\s*:/;

  for (const file of await workflowFiles()) {
    const lines = (await text(file)).split(/\r?\n/);

    lines.forEach((line, index) => {
      if (!/^\s*-\s*name:\s*\S/.test(line)) return;

      // A blank line between `- name:` and its keys is legal YAML and is used
      // throughout this repository, so skip over whitespace before deciding
      // what actually follows the step.
      let ahead = index + 1;
      while (ahead < lines.length && lines[ahead].trim() === "") ahead++;
      const next = (lines[ahead] ?? "").trim();

      assert.ok(
        STEP_KEY.test(next),
        `${file} line ${index + 1}: step ${JSON.stringify(line.trim())} is ` +
          `followed by ${JSON.stringify(next)}, which is not a valid step key. ` +
          `GitHub rejects the whole workflow file if any step is malformed.`,
      );
    });
  }
});
// A workflow that produces release evidence must not be cancelled part-way
// through: cancelling one mid-flight discards the artifact uploads that the
// checksum step verifies, which is how REL-03 lost its evidence.
const RELEASE_WORKFLOWS = [
  "release-desktop.yml",
  "release-mobile.yml",
  "release-evidence.yml",
  "stability-soak.yml",
];

test("release workflows must not cancel in-progress runs", async () => {
  for (const file of RELEASE_WORKFLOWS) {
    const cancel = (await text(file)).match(
      /^\s*cancel-in-progress:\s*(true|false)\s*$/m,
    );

    assert.ok(cancel, `${file} must declare cancel-in-progress`);
    assert.equal(
      cancel[1],
      "false",
      `${file} sets cancel-in-progress: ${cancel[1]}. Cancelling a release ` +
        `mid-flight discards the artifact uploads that the checksum step ` +
        `verifies, which is how REL-03 lost its evidence.`,
    );
  }
});

test("no workflow embeds its own filename in the concurrency group", async () => {
  // release-mobile and rebuild-rust both carried a group of the form
  // "orbit-.github-workflows-<file>.yml-${{ github.ref }}", which is a
  // generator artefact rather than an intent to serialise runs. It reads like
  // a path that no author chose on purpose.
  for (const file of await workflowFiles()) {
    const group = (await text(file)).match(/^\s*group:\s*(.+?)\s*$/m);
    if (!group) continue;

    assert.ok(
      !/\.ya?ml/.test(group[1]),
      `${file} concurrency group ${JSON.stringify(group[1])} embeds a ` +
        `workflow filename. Use a stable name such as orbit-<purpose>.`,
    );
  }
});

test("the release checksum step refuses to run with zero artifacts", async () => {
  // `xargs -0 sha256sum` invoked with no file arguments reads stdin instead and
  // emits the checksum of empty input, so a build that produced no bundle used
  // to write a SHA256SUMS.txt that passed both `test -s` and `sha256sum -c`.
  // The publish step's own guard caught it, but the checksum step must refuse
  // on its own rather than depend on a later job.
  const body = await text("release-desktop.yml");
  const step = body.split("- name: Build checksums")[1] ?? "";
  const block = step.split("- name:")[0];

  assert.match(
    block,
    /if \[ "\$\{#ARTIFACTS\[@\]\}" -eq 0 \]/,
    "Build checksums must refuse when no artifacts were collected",
  );
  assert.match(
    block,
    /exit 1/,
    "the empty-artifact guard must fail the step, not warn and continue",
  );
  assert.doesNotMatch(
    block,
    /^\s*find release-assets .*\|.*xargs -0 sha256sum/m,
    "the bare find|xargs pipeline emits a checksum of empty input when no " +
      "files match; the artifact count must gate it first",
  );
});

// Splits a workflow's raw text into its top-level jobs, so a test can assert
// that a prerequisite and its consumer live in the same job. Cross-job ordering
// is not sufficient: each job gets fresh runners with their own caches.
function jobBlocks(workflow) {
  const lines = workflow.split(/\r?\n/);
  const jobs = [];
  let name = null;
  let body = [];

  for (const line of lines) {
    if (/^ {2}[A-Za-z0-9_-]+:\s*$/.test(line)) {
      if (name !== null) jobs.push({ name, body: body.join("\n") });
      name = line.trim().replace(":", "");
      body = [];
    } else if (name !== null) {
      body.push(line);
    }
  }
  if (name !== null) jobs.push({ name, body: body.join("\n") });
  return jobs;
}

test("every job that builds the desktop installs Playwright browsers first", async () => {
  // `tauri icon` and the desktop `beforeBuildCommand` both launch a headless
  // Chromium (scripts/build-icon.mjs). Release run 37283724466 failed at
  // `Build desktop` on all four platforms with "Executable doesn't exist at
  // .../chrome-headless-shell" because the build job had no install step; the
  // quality job's install does not carry over to separate runners.
  const files = await workflowFiles();
  const offenders = [];
  const missing = [];
  let covered = 0;

  for (const file of files) {
    for (const job of jobBlocks(await text(file))) {
      // Match the command, not prose: comments mention `tauri icon` too.
      const builds = /run:.*tauri build/.test(job.body);
      if (!builds) continue;

      covered++;
      const install = job.body.search(/playwright install/);
      const desktopBuild = job.body.search(/^\s*run:.*tauri (build|icon)/m);

      if (install < 0) missing.push(`${file} job ${job.name}`);
      else if (install > desktopBuild)
        offenders.push(`${file} job ${job.name}`);
    }
  }

  assert.deepEqual(
    missing,
    [],
    "these jobs run `tauri build` but never `playwright install`, so " +
      "scripts/build-icon.mjs cannot launch its headless Chromium",
  );
  assert.deepEqual(
    offenders,
    [],
    "these jobs install Playwright after starting the desktop build",
  );
  // Exactly two today: desktop-native-validation.yml/bundle and
  // release-desktop.yml/build. The floor exists so this cannot silently stop
  // checking anything if job parsing breaks.
  assert.equal(
    covered,
    2,
    `expected 2 desktop-building jobs, found ${covered}`,
  );
});

test("every job that runs a git-dependent gh command checks out the repo", async () => {
  // `gh release create` resolves the repository from git and `--generate-notes`
  // reads history. Run 37286268618 built all four desktop artifacts and
  // verified 314 checksums, then failed on the publish line with
  // "failed to run git: fatal: not a git repository" because the job never
  // checked out. Scanning every job, not a hand-picked list, so the same gap
  // cannot appear in another workflow.
  const files = await workflowFiles();
  const offenders = [];
  let covered = 0;

  for (const file of files) {
    for (const job of jobBlocks(await text(file))) {
      // `gh release create` sits on a continuation line of a `run: |`
      // block, so scan the whole job and drop comment lines.
      const commands = job.body
        .split("\n")
        .filter((l) => !/^\s*#/.test(l))
        .join("\n");
      // `gh release`, `gh api` and `gh pr` all shell out to git for repo
      // resolution; `gh run`/`gh auth` do not need a working tree.
      const needsGit = /\bgh (release|api|pr|issue|workflow)\b/.test(commands);
      if (!needsGit) continue;

      covered++;
      if (!/actions\/checkout@/.test(job.body))
        offenders.push(`${file} job ${job.name}`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    "these jobs run git-dependent `gh` commands but never `actions/checkout`, " +
      "so they fail with 'fatal: not a git repository'",
  );
  assert.ok(covered >= 1, `expected at least one such job, found ${covered}`);
});

test("the release publish step uploads bundles, not files inside them", async () => {
  // The artifact payloads contain a full `AppDir/` tree, so `find -type f`
  // offered 314 paths of which only 268 basenames are unique. GitHub rejects
  // duplicate asset names, and run 37289634184 died on the first upload with
  // `HTTP 404` against a release id that never resolved. Uploading the
  // distributable bundles fixes it: 7 files, 7 unique basenames.
  const body = await text("release-desktop.yml");
  const publish = jobBlocks(body).find((j) => j.name === "publish");
  assert.ok(publish, "release-desktop.yml has no publish job");

  const step = publish.body.match(/gh release create[\s\S]*$/);
  assert.ok(step, "the publish job never runs `gh release create`");

  // The asset list must be filtered by extension, and must reject duplicates
  // up front rather than discovering them mid-upload.
  const mapfile = publish.body.match(/mapfile -d '' ASSETS[\s\S]*?-print0\)/);
  assert.ok(mapfile, "the publish job does not build an ASSETS list");
  for (const ext of [".AppImage", ".dmg", ".deb", ".msi", ".rpm", ".exe"]) {
    assert.ok(
      mapfile[0].includes(ext),
      `the ASSETS filter does not select ${ext} bundles`,
    );
  }
  assert.match(
    publish.body,
    /duplicate asset basenames/,
    "the publish step does not guard against duplicate asset basenames",
  );
  assert.doesNotMatch(
    mapfile[0],
    /find release-assets -type f\s+-print0/,
    "the ASSETS list still selects every file under release-assets, which " +
      "includes AppImage internals and collides on asset names",
  );
});

test("the release duplicate-asset guard does not word-split paths", async () => {
  // Every bundle name contains spaces ("ORBIT Marketing OS_1.0.0_x64.dmg").
  // A plain `xargs -n1 basename` splits each into three tokens, so 7 real
  // files reported 9 distinct names and the guard aborted a release with no
  // actual collision — run 37293663120 died there. `xargs -0` reports 7.
  const body = await text("release-desktop.yml");
  const publish = jobBlocks(body).find((j) => j.name === "publish");
  assert.ok(publish, "release-desktop.yml has no publish job");

  // Anchor to the command, not prose: the comment above it names the broken
  // `xargs -n1 basename` form deliberately, to explain why `-0` is required.
  const guard = publish.body.match(/^\s*\|?\s*xargs[^\n]*basename/m);
  assert.ok(guard, "the publish job has no basename-based duplicate guard");
  assert.match(
    guard[0],
    /xargs\s+-0/,
    `the duplicate-asset guard uses ${JSON.stringify(guard[0])}, which ` +
      "word-splits paths containing spaces and false-positives on every bundle",
  );
  assert.doesNotMatch(
    guard[0],
    /xargs\s+(?!--0)-n/,
    "the duplicate-asset guard uses `xargs -n1`, which word-splits paths " +
      "containing spaces",
  );
});
