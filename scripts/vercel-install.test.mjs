import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Vercel installer is frozen when a lockfile exists and bootstraps only as a transition", async () => {
  const script = await readFile(new URL("./vercel-install.sh", import.meta.url), "utf8");
  assert.match(script, /-s pnpm-lock\.yaml/);
  assert.match(script, /--frozen-lockfile/);
  assert.match(script, /--no-frozen-lockfile/);
  assert.match(script, /transitional web build/);
});
