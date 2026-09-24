import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolveRoot();
const requiredFiles = [
  "package.json",
  "pnpm-workspace.yaml",
  "turbo.json",
  "tsconfig.base.json",
  "docs/ACCEPTANCE_MATRIX_V2.md",
  "docs/RELEASE_GATES.md",
  "packages/core/package.json",
  "packages/desktop/package.json",
  "packages/mobile/package.json",
  "packages/web/package.json",
  "packages/shared-ui/package.json",
  "packages/desktop/src-tauri/Cargo.toml",
];

function resolveRoot() {
  return join(dirname(fileURLToPath(import.meta.url)), "..");
}

async function readJson(path) {
  return JSON.parse(await readFile(join(root, path), "utf8"));
}

async function assertFile(path) {
  try {
    await readFile(join(root, path));
  } catch {
    throw new Error("Missing required file: " + path);
  }
}

for (const file of requiredFiles) await assertFile(file);

const rootPackage = await readJson("package.json");
if (rootPackage.packageManager !== "pnpm@10.17.1") {
  throw new Error("Expected root packageManager pnpm@10.17.1");
}
if (!rootPackage.scripts?.lint || !rootPackage.scripts?.typecheck || !rootPackage.scripts?.test || !rootPackage.scripts?.build) {
  throw new Error("Root quality scripts are incomplete");
}

const webPackage = await readJson("packages/web/package.json");
if (webPackage.scripts?.lint !== "eslint .") {
  throw new Error("Web lint must use the ESLint CLI");
}
if (webPackage.scripts?.["lint"]?.includes("next lint")) {
  throw new Error("Removed next lint command detected");
}

const desktopPackage = await readJson("packages/desktop/package.json");
if (!desktopPackage.scripts?.build || !desktopPackage.scripts?.typecheck) {
  throw new Error("Desktop build/typecheck scripts are incomplete");
}

const mobilePackage = await readJson("packages/mobile/package.json");
if (!mobilePackage.scripts?.build || !mobilePackage.scripts?.test) {
  throw new Error("Mobile build/test scripts are incomplete");
}

const ignored = new Set([".git", "node_modules", ".next", "out", "dist", "build", ".turbo", ".expo"]);
const forbiddenFragments = ["next lint", "typecheck:all", "test:all", "build:all", "app.get(\"*\")", "app.get(\'/*\')"];

async function scan(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (relative(root, full) === "scripts/verify-workspace.mjs") continue;
    if (entry.isDirectory()) {
      await scan(full);
      continue;
    }
    if (!/\.(?:json|ya?ml|mjs|cjs|js|ts|tsx|rs|toml|sh)$/.test(entry.name)) continue;
    const content = await readFile(full, "utf8");
    for (const fragment of forbiddenFragments) {
      if (content.includes(fragment)) {
        throw new Error("Stale command/contract fragment detected in " + relative(root, full) + ": " + fragment);
      }
    }
  }
}

await scan(root);
console.log("ORBIT workspace sanity checks passed.");
