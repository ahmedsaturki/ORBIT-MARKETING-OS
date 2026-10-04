import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

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
