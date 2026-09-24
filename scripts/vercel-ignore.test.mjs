import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("vercel ignore script fails open to build when Git revision context is absent", async () => {
  const script = await readFile(new URL("./vercel-ignore.sh", import.meta.url), "utf8");
  assert.match(script, /VERCEL_GIT_PREVIOUS_SHA/);
  assert.match(script, /VERCEL_GIT_COMMIT_SHA/);
  assert.match(script, /exit 1/);
  assert.match(script, /git diff --quiet/);
  assert.match(script, /packages\/web/);
});
