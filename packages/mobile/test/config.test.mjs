import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const app = JSON.parse(await readFile(resolve(root, "app.json"), "utf8"));

test("Expo config declares stable application identity", () => {
  assert.equal(app.expo.name, "ORBIT Marketing OS");
  assert.equal(app.expo.slug, "orbit-marketing-os");
  assert.equal(app.expo.scheme, "orbit");
  assert.equal(app.expo.android.package, "com.orbitmarketing.os");
  assert.equal(app.expo.ios.bundleIdentifier, "com.orbitmarketing.os");
  assert.deepEqual(app.expo.plugins, ["expo-router"]);
});

test("Expo config is pinned to portrait + dark UI defaults", () => {
  assert.equal(app.expo.orientation, "portrait");
  assert.equal(app.expo.userInterfaceStyle, "dark");
});
