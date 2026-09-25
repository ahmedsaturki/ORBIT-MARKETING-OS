import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("root package pins the intended package manager", async () => {
  const pkg = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  assert.equal(pkg.packageManager, "pnpm@10.17.1");
  assert.equal(typeof pkg.scripts["verify:workspace"], "string");
});
