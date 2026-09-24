import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Vercel installer fails closed without a lockfile and uses frozen install when present", async () => {
  const script = await readFile(new URL("./vercel-install.sh", import.meta.url), "utf8");
  assert.match(script, /-s pnpm-lock\.yaml/);
  assert.match(script, /--frozen-lockfile/);
  assert.match(script, /required for a reproducible Vercel build/);
});
