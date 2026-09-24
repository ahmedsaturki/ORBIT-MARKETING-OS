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
  "packages/core/src/access/control.ts",
  "packages/desktop/package.json",
  "packages/mobile/package.json",
  "packages/web/package.json",
  "packages/shared-ui/package.json",
  "packages/desktop/src-tauri/Cargo.toml",
  "packages/web/public/icon.svg",
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

const corePackage = await readJson("packages/core/package.json");
if (corePackage.scripts?.["test:coverage"] && !corePackage.devDependencies?.["@vitest/coverage-v8"]) {
  throw new Error("Core coverage command requires @vitest/coverage-v8");
}

const webPackage = await readJson("packages/web/package.json");
if (webPackage.scripts?.lint !== "eslint .") {
  throw new Error("Web lint must use the ESLint CLI");
}
if (webPackage.scripts?.["lint"]?.includes("next lint")) {
  throw new Error("Removed next lint command detected");
}

await assertFile("packages/web/eslint.config.mjs");
await assertFile("packages/mobile/test/runtimeClient.test.ts");
const webEslint = await readJson("packages/web/package.json");
if (!webEslint.devDependencies?.eslint || !webEslint.devDependencies?.["eslint-config-next"]) {
  throw new Error("Web ESLint dependencies are incomplete");
}

const desktopPackage = await readJson("packages/desktop/package.json");
if (!desktopPackage.scripts?.build || !desktopPackage.scripts?.typecheck) {
  throw new Error("Desktop build/typecheck scripts are incomplete");
}

const mobilePackage = await readJson("packages/mobile/package.json");
if (!mobilePackage.scripts?.build || !mobilePackage.scripts?.test) {
  throw new Error("Mobile build/test scripts are incomplete");
}

const rustPath = join(root, "packages/desktop/src-tauri/src/lib.rs");
const rust = await readFile(rustPath, "utf8");
const rustFunctions = [...rust.matchAll(/\bfn\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)].map((match) => match[1]);
const duplicateFunctions = new Map();
for (const name of rustFunctions) {
  duplicateFunctions.set(name, (duplicateFunctions.get(name) ?? 0) + 1);
}
for (const [name, count] of duplicateFunctions) {
  if (count > 1) throw new Error("Duplicate Rust function definition: " + name);
}

const testModuleMarker = rust.indexOf("#[cfg(test)]");
const productionRust = testModuleMarker >= 0 ? rust.slice(0, testModuleMarker) : rust;
if (/\.unwrap\s*\(|\.expect\s*\(|\bpanic!\s*\(/.test(productionRust)) {
  throw new Error("Unchecked Rust unwrap/expect/panic detected outside tests");
}

if (!rust.includes("BEGIN IMMEDIATE")) {
  throw new Error("Audit writes must serialize through BEGIN IMMEDIATE");
}

for (const command of ["workspace_list", "workspace_current", "workspace_create", "workspace_select"]) {
  if (!new RegExp("fn\\s+" + command + "\\s*\\(").test(rust)) {
    throw new Error("Missing workspace command: " + command);
  }
}
const invokeHandler = rust.slice(rust.lastIndexOf(".invoke_handler(tauri::generate_handler!["));
for (const command of ["workspace_list", "workspace_current", "workspace_create", "workspace_select"]) {
  if (!invokeHandler.includes(command)) {
    throw new Error("Workspace command is not registered in Tauri invoke handler: " + command);
  }
}

const defaultWorkspaceDeclarationCount = (rust.match(/const DEFAULT_WORKSPACE_ID:\s*&str\s*=\s*"default";/g) ?? []).length;
if (defaultWorkspaceDeclarationCount !== 1) {
  throw new Error("DEFAULT_WORKSPACE_ID must have exactly one declaration");
}

if (!desktopPackage.dependencies?.["@orbit/core"]) {
  throw new Error("Desktop must consume @orbit/core through the workspace dependency");
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
