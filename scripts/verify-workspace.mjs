import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolveRoot();
const requiredFiles = [
  "package.json",
  "pnpm-workspace.yaml",
  "turbo.json",
  "pnpm-lock.yaml",
  "packages/desktop/src-tauri/Cargo.lock",
  "tsconfig.base.json",
  "docs/ACCEPTANCE_MATRIX_V2.md",
  "docs/RELEASE_GATES.md",
  "packages/core/package.json",
  "packages/core/src/access/control.ts",
  "packages/core/src/content/catalog.ts",
  "packages/core/src/media/catalog.ts",
  "packages/core/src/analytics/metrics.ts",
  "packages/core/src/automation/rules.ts",
  "packages/core/src/connectors/linkedin.ts",
  "packages/desktop/package.json",
  "packages/mobile/package.json",
  "packages/web/package.json",
  "packages/shared-ui/package.json",
  "packages/desktop/src-tauri/Cargo.toml",
  "packages/web/public/icon.svg",
  "vercel.json",
  "scripts/vercel-ignore.sh",
  "scripts/vercel-install.sh",
  "packages/core/test/linkedin.test.ts",
  "packages/core/test/executor.test.ts",
  "e2e/web-smoke.spec.ts",
  "e2e/public-web.spec.ts",
  "playwright.config.ts",
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

const workspacePackagePaths = [
  "packages/core/package.json",
  "packages/desktop/package.json",
  "packages/mobile/package.json",
  "packages/web/package.json",
  "packages/shared-ui/package.json",
];
for (const path of workspacePackagePaths) {
  const pkg = await readJson(path);
  if (pkg.version !== rootPackage.version) {
    throw new Error(
      "Workspace package version drift detected: " + path + " (" + pkg.version + " != " + rootPackage.version + ")",
    );
  }
}

const tauriReleaseConfig = JSON.parse(
  await readFile(join(root, "packages/desktop/src-tauri/tauri.conf.json"), "utf8"),
);
if (tauriReleaseConfig.version !== rootPackage.version) {
  throw new Error(
    "Tauri product version drift detected (" +
      tauriReleaseConfig.version +
      " != " +
      rootPackage.version +
      ")",
  );
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

const tauriCapabilities = await readJson("packages/desktop/src-tauri/capabilities/default.json");
if (
  !Array.isArray(tauriCapabilities.permissions) ||
  tauriCapabilities.permissions.length !== 1 ||
  tauriCapabilities.permissions[0] !== "core:default"
) {
  throw new Error("Unexpected Tauri renderer capability expansion");
}

const tauriConfig = JSON.parse(
  await readFile(join(root, "packages/desktop/src-tauri/tauri.conf.json"), "utf8"),
);
if (
  typeof tauriConfig.app?.security?.csp !== "string" ||
  !tauriConfig.app.security.csp.includes("connect-src 'self' http://127.0.0.1:3000") ||
  !tauriConfig.app.security.csp.includes("img-src 'self' data: blob:") ||
  !tauriConfig.app.security.csp.includes("object-src 'none'")
) {
  throw new Error("Tauri CSP does not match the local AI security contract");
}

const desktopApp = await readFile(join(root, "packages/desktop/src/App.tsx"), "utf8");
if (desktopApp.includes("اختبار خزنة محلية حقيقية") && !desktopApp.includes("import.meta.env.DEV")) {
  throw new Error("Vault plaintext diagnostic must remain development-only");
}

await assertFile("scripts/verify-ipc.mjs");
const desktopPackage = await readJson("packages/desktop/package.json");
if (!desktopPackage.scripts?.build || !desktopPackage.scripts?.typecheck) {
  throw new Error("Desktop build/typecheck scripts are incomplete");
}

const mobilePackage = await readJson("packages/mobile/package.json");
if (!mobilePackage.scripts?.build || !mobilePackage.scripts?.test) {
  throw new Error("Mobile build/test scripts are incomplete");
}

const rustSourceDir = join(root, "packages/desktop/src-tauri/src");
const rustSourcePaths = (await readdir(rustSourceDir, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith(".rs"))
  .map((entry) => join(rustSourceDir, entry.name));

if (rustSourcePaths.length === 0) {
  throw new Error("No Rust source files found in desktop runtime");
}

const rustSources = [];
for (const path of rustSourcePaths) {
  rustSources.push({
    path,
    content: await readFile(path, "utf8"),
  });
}

const rust = rustSources.map((entry) => entry.content).join("\n");

const duplicateDerivePattern = /#\[derive\(([^\n]+)\)\]\s*#\[derive\(\1\)\]/;
if (duplicateDerivePattern.test(rust)) {
  throw new Error("Duplicate consecutive Rust derive attribute detected");
}

const rustFunctions = [];
for (const entry of rustSources) {
  rustFunctions.push(
    ...[...entry.content.matchAll(/\bfn\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)].map((match) => ({
      name: match[1],
      path: relative(root, entry.path),
    })),
  );
}
const duplicateFunctions = new Map();
for (const value of rustFunctions) {
  duplicateFunctions.set(value.name, [...(duplicateFunctions.get(value.name) ?? []), value.path]);
}
for (const [name, paths] of duplicateFunctions) {
  if (paths.length > 1) {
    const uniquePaths = [...new Set(paths)];
    if (uniquePaths.length === 1) {
      throw new Error("Duplicate Rust function definition: " + name);
    }
  }
}

for (const entry of rustSources) {
  const testModuleMarker = entry.content.indexOf("#[cfg(test)]");
  const productionRust = testModuleMarker >= 0 ? entry.content.slice(0, testModuleMarker) : entry.content;
  if (/\.unwrap\s*\(|\.expect\s*\(|\bpanic!\s*\(/.test(productionRust)) {
    throw new Error("Unchecked Rust unwrap/expect/panic detected outside tests in " + relative(root, entry.path));
  }
}

if (!rust.includes("CREATE TABLE IF NOT EXISTS media_assets")) {
  throw new Error("Media metadata persistence table is missing");
}
if (!rust.includes("CREATE TABLE IF NOT EXISTS automation_rule_packs")) {
  throw new Error("Automation rule-pack persistence table is missing");
}
if (!rust.includes("fn media_asset_import(")) {
  throw new Error("Media import command is missing");
}
if (!rust.includes("fn media_asset_delete(")) {
  throw new Error("Media delete command is missing");
}
if (!rust.includes("fn automation_rule_pack_set_enabled(")) {
  throw new Error("Rule-pack lifecycle command is missing");
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
const forbiddenProductionSafetyTerms = [
  "fingerprint cloaking",
  "fingerprint spoof",
  "browser fingerprint",
  "stealth automation",
  "playwright stealth",
  "anti-ban",
  "antiban",
  "captcha bypass",
  "CAPTCHA bypass",
];

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
    for (const fragment of forbiddenProductionSafetyTerms) {
      if (content.toLowerCase().includes(fragment.toLowerCase())) {
        throw new Error(
          "Forbidden stealth/evasion language detected in production source: " +
          relative(root, full) +
          ": " +
          fragment,
        );
      }
    }
  }
}

for (const sourceRoot of productionRoots) {
  await scanProductionSource(sourceRoot);
}

for (const entry of rustSources) {
  if (/\b(TODO|FIXME|HACK|XXX)\b/i.test(entry.content)) {
    throw new Error("Production Rust source contains TODO/FIXME/HACK/XXX: " + relative(root, entry.path));
  }
  if (/\b(?:PLACEHOLDER|CHANGE_ME|TBD)\b/i.test(entry.content)) {
    throw new Error("Production Rust source contains placeholder marker: " + relative(root, entry.path));
  }
}

const tauriCommandDefinitions = [];
for (const entry of rustSources) {
  tauriCommandDefinitions.push(
    ...[...entry.content.matchAll(/#\[tauri::command\]\s*(?:pub\s+)?(?:async\s*)?fn\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)].map((match) => ({
      name: match[1],
      path: relative(root, entry.path),
    })),
  );
}

const registeredHandler = rustSources
  .map((entry) => {
    const marker = ".invoke_handler(tauri::generate_handler![";
    const index = entry.content.lastIndexOf(marker);
    return index >= 0 ? entry.content.slice(index) : "";
  })
  .filter(Boolean)
  .join("\n");

for (const command of tauriCommandDefinitions) {
  if (!registeredHandler.includes(command.name)) {
    throw new Error(
      "Tauri command definition is not registered in invoke handler: " +
        command.name +
        " (" +
        command.path +
        ")",
    );
  }
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
  media_asset_upsert: ["owner", "admin", "editor"],
  media_asset_import: ["owner", "admin", "editor"],
  media_asset_delete: ["owner", "admin", "editor"],
  automation_rule_pack_set_enabled: ["owner", "admin", "editor"],
  automation_rule_pack_upsert: ["owner", "admin", "editor"],
};

const rustCommandPositions = [...rust.matchAll(/#\[tauri::command\]\s*(?:pub\s+)?(?:async\s*)?fn\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)]
  .map((match) => ({ name: match[1], index: match.index ?? -1 }))
  .filter((value) => value.index >= 0);

for (const command of Object.keys(sensitiveDesktopCommands)) {
  const current = rustCommandPositions.find((value) => value.name === command);
  if (!current) throw new Error("Missing sensitive Tauri command: " + command);

  const next = rustCommandPositions
    .filter((value) => value.index > current.index)
    .sort((a, b) => a.index - b.index)[0]?.index ?? rust.length;

  const segment = rust.slice(current.index, next);
  if (!segment.includes("require_workspace_role(") && !segment.includes("require_workspace_role_for(") && !segment.includes("require_workspace_role_for_module(")) {
    throw new Error("Sensitive Tauri command is not role-gated: " + command);
  }
  if (segment.includes("active_workspace_id()") && !segment.includes("let workspace_id = active_workspace_id();")) {
    throw new Error("Sensitive Tauri command uses global workspace lookup without a local snapshot: " + command);
  }
}

const rootVercel = JSON.parse(await readFile(join(root, "vercel.json"), "utf8"));
if (rootVercel.framework !== "nextjs") throw new Error("Root Vercel framework must be nextjs");
if (rootVercel.outputDirectory !== "packages/web/out") throw new Error("Root Vercel output directory must be packages/web/out");
if (rootVercel.installCommand !== "bash scripts/vercel-install.sh") throw new Error("Root Vercel must use the lockfile-aware install script");
if (rootVercel.ignoreCommand !== "bash scripts/vercel-ignore.sh") throw new Error("Root Vercel must use the versioned ignore script");



const workflowFiles = [
  ".github/workflows/ci.yml",
  ".github/workflows/rebuild-rust.yml",
  ".github/workflows/release-desktop.yml",
  ".github/workflows/release-mobile.yml",
  ".github/workflows/vercel-web.yml",
  ".github/workflows/self-hosted-verify.yml",
  ".github/workflows/bootstrap-lockfile.yml",
];
const bootstrapWorkflow = await readFile(join(root, ".github/workflows/bootstrap-lockfile.yml"), "utf8");
if (!bootstrapWorkflow.includes("workflow_dispatch:")) {
  throw new Error("Lockfile bootstrap must be manually dispatched");
}
if (!bootstrapWorkflow.includes("contents: write")) {
  throw new Error("Lockfile bootstrap requires explicit contents: write permission");
}
if (!bootstrapWorkflow.includes("git push origin \"HEAD:${GITHUB_REF_NAME}\"")) {
  throw new Error("Lockfile bootstrap must push only the selected branch");
}

const selfHostedWorkflow = await readFile(join(root, ".github/workflows/self-hosted-verify.yml"), "utf8");
if (!selfHostedWorkflow.includes("github.ref_name == 'rebuild/orbit-production'")) {
  throw new Error("Self-hosted verification must be restricted to rebuild/orbit-production");
}

for (const workflow of workflowFiles) {
  const content = await readFile(join(root, workflow), "utf8");
  if (/runs-on:\s*ubuntu-latest/.test(content) && !content.includes("timeout-minutes:")) {
    throw new Error("Workflow is missing timeout-minutes: " + workflow);
  }
  if (content.includes("dtolnay/rust-toolchain@master") || content.includes("dtolnay/rust-toolchain@stable")) {
    throw new Error("Moving Rust toolchain action reference detected: " + workflow);
  }
  if (/uses:\s*[^\s@]+\/[^\s@]+@v\d+(?:\.\d+)*(?:\s|$)/m.test(content)) {
    throw new Error("Floating GitHub Action reference detected in " + workflow);
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
