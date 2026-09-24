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

const productionRoots = [
  "packages/core/src",
  "packages/desktop/src",
  "packages/mobile",
  "packages/web/src",
  "packages/shared-ui/src",
];

const forbiddenTypeScriptAny = /(?:\:\s*any\b|\bas\s+any\b|\bany\[\]|Record<[^>]*,\s*any\s*>)/;
async function scanProductionSource(dir) {
  for (const entry of await readdir(join(root, dir), { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = join(root, dir, entry.name);
    if (entry.isDirectory()) {
      await scanProductionSource(join(dir, entry.name));
      continue;
    }
    if (!/\.(?:ts|tsx|mjs)$/.test(entry.name)) continue;
    if (relative(root, full) === "scripts/verify-workspace.mjs") continue;
    const content = await readFile(full, "utf8");
    if (forbiddenTypeScriptAny.test(content)) {
      throw new Error("Production source uses implicit any in " + relative(root, full));
    }
  }
}

for (const sourceRoot of productionRoots) {
  await scanProductionSource(sourceRoot);
}

const sensitiveDesktopCommands = {
  backup_create: ["owner", "admin"],
  backup_list: ["owner", "admin"],
  backup_restore: ["owner", "admin"],
  vault_put: ["owner", "admin"],
  vault_get: ["owner", "admin"],
  vault_delete: ["owner", "admin"],
  account_upsert: ["owner", "admin"],
  account_delete: ["owner", "admin"],
  task_enqueue: ["owner", "admin", "editor"],
  task_claim_next: ["owner", "admin", "operator"],
  task_set_status: ["owner", "admin", "operator"],
  content_upsert: ["owner", "admin", "editor"],
  approval_decide: ["owner", "admin", "reviewer"],
  license_install: ["owner", "admin"],
  license_delete: ["owner", "admin"],
  telegram_execute_task: ["owner", "admin", "operator"],
};

const rustCommandPositions = [...rust.matchAll(/#\[tauri::command\]\s*(?:async\s*)?fn\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)]
  .map((match) => ({ name: match[1], index: match.index ?? -1 }))
  .filter((value) => value.index >= 0);

for (const command of Object.keys(sensitiveDesktopCommands)) {
  const current = rustCommandPositions.find((value) => value.name === command);
  if (!current) throw new Error("Missing sensitive Tauri command: " + command);

  const next = rustCommandPositions
    .filter((value) => value.index > current.index)
    .sort((a, b) => a.index - b.index)[0]?.index ?? rust.length;

  const segment = rust.slice(current.index, next);
  if (!segment.includes("require_workspace_role(") && !segment.includes("require_workspace_role_for(")) {
    throw new Error("Sensitive Tauri command is not role-gated: " + command);
  }
  if (segment.includes("active_workspace_id()") && !segment.includes("let workspace_id = active_workspace_id();")) {
    throw new Error("Sensitive Tauri command uses global workspace lookup without a local snapshot: " + command);
  }
}

const webVercel = JSON.parse(await readFile(join(root, "packages/web/vercel.json"), "utf8"));
if (webVercel.framework !== "nextjs") throw new Error("Web Vercel framework must be nextjs");
if (webVercel.outputDirectory !== "out") throw new Error("Web Vercel output directory must be out");
if (webVercel.installCommand !== "pnpm install --frozen-lockfile") throw new Error("Web Vercel install must use frozen lockfile");
if (!webVercel.ignoreCommand.includes("exit 1")) throw new Error("Web Vercel must fail closed when lockfile is missing");


const workflowFiles = [
  ".github/workflows/ci.yml",
  ".github/workflows/rebuild-rust.yml",
  ".github/workflows/release-desktop.yml",
  ".github/workflows/release-mobile.yml",
  ".github/workflows/vercel-web.yml",
  ".github/workflows/self-hosted-verify.yml",
];
for (const workflow of workflowFiles) {
  const content = await readFile(join(root, workflow), "utf8");
  if (/runs-on:\s*ubuntu-latest/.test(content) && !content.includes("timeout-minutes:")) {
    throw new Error("Workflow is missing timeout-minutes: " + workflow);
  }
  if (content.includes("dtolnay/rust-toolchain@master") || content.includes("dtolnay/rust-toolchain@stable")) {
    throw new Error("Moving Rust toolchain action reference detected: " + workflow);
  }
}
await assertFile("rust-toolchain.toml");
const rustToolchain = await readFile(join(root, "rust-toolchain.toml"), "utf8");
if (!rustToolchain.includes('channel = "1.98.1"')) {
  throw new Error("Rust toolchain is not pinned to 1.98.1");
}

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
