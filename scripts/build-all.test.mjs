import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("build-all requires a committed lockfile", async () => {
  const script = await readFile(
    new URL("./build-all.sh", import.meta.url),
    "utf8",
  );
  assert.match(script, /pnpm-lock\.yaml/);
  assert.match(script, /exit 1/);
  assert.match(script, /--frozen-lockfile/);
});
