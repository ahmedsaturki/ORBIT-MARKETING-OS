import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { readdir } from "node:fs/promises";
import { parse } from "yaml";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const WORKFLOW_DIR = join(ROOT, ".github", "workflows");

// Returns each step's name paired with its `run:` command, in file order, so a
// test can assert on relative ordering rather than absolute line numbers.
async function steps(workflow) {
  const text = await readFile(
    join(ROOT, ".github", "workflows", workflow),
    "utf8",
  );
  const out = [];
  let current = null;
  text.split(/\r?\n/).forEach((line, index) => {
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
  const found = await steps(workflow);
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

test("every workflow uses LF endings and parses as YAML", async () => {
  // Three workflows (release-mobile, self-hosted-verify,
  // web-release-selfhosted) carried a doubled carriage return on the same
  // three-line "Governed audit exceptions" block. `\r\r\n` is not a valid YAML
  // line terminator, so GitHub reported "This run likely failed because of a
  // workflow file issue" and the workflow never executed. `.gitattributes` pins
  // `* text=auto eol=lf`, so a stray CR in the committed blob is a real defect
  // rather than a platform artefact.
  const files = (await readdir(WORKFLOW_DIR)).filter((f) => /\.ya?ml$/.test(f));
  assert.ok(files.length > 0, "no workflow files found");

  for (const file of files) {
    const text = (await readFile(join(WORKFLOW_DIR, file))).toString("utf8");

    assert.ok(
      !/\r/.test(text),
      `${file} contains a carriage return; .gitattributes requires eol=lf. ` +
        `GitHub rejects a doubled CR as an invalid YAML line terminator, so ` +
        `the workflow fails to load before any step runs.`,
    );
    assert.doesNotThrow(() => parse(text), `${file} must parse as valid YAML`);
  }
});
