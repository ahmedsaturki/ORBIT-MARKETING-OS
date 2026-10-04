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

async function assertBuildPrecedesE2E(workflow) {
  const found = await stepList(workflow);
  const build = found.find((s) => s.run === "pnpm build");
  const e2e = found.find((s) => s.run === "pnpm test:e2e");

  assert.ok(build, `${workflow} must run "pnpm build"`);
  assert.ok(e2e, `${workflow} must run "pnpm test:e2e"`);
  assert.ok(
    build.line < e2e.line,
    `${workflow}: "pnpm build" (line ${build.line}) must precede ` +
      `"pnpm test:e2e" (line ${e2e.line}); otherwise packages/web/out ` +
      `does not exist when Playwright starts its webServer`,
  );
}

test("release quality gate builds the web export before running browser E2E", async () => {
  // The E2E suite serves packages/web/out through scripts/static-server.mjs and
  // Playwright's webServer wait has a 30s budget. Without the build the export
  // is absent and the step dies with
  // "Error: Timed out waiting 30000ms from config.webServer" — exactly how
  // release run 37205123765 failed on tag v1.0.0, blocking Build checksums
  // and Publish GitHub Release and leaving REL-03 without evidence.
  await assertBuildPrecedesE2E("release-desktop.yml");
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
