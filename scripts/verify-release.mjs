import { readFile, readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const fail = (message) => {
  console.error("RELEASE VERIFY FAILED:", message);
  process.exit(1);
};

const readJson = async (path) => JSON.parse(await readFile(join(root, path), "utf8"));

for (const file of ["pnpm-lock.yaml", "packages/desktop/src-tauri/Cargo.lock"]) {
  try {
    const content = await readFile(join(root, file), "utf8");
    if (!content.trim()) fail(file + " is empty");
  } catch {
    fail("Missing required reproducible lockfile: " + file);
  }
}

const rootPackage = await readJson("package.json");
if (rootPackage.packageManager !== "pnpm@10.17.1") fail("root packageManager drifted");
if (rootPackage.engines?.node !== ">=22 <25") fail("Node engine contract drifted");

const packageFiles = [
  "packages/core/package.json",
  "packages/desktop/package.json",
  "packages/mobile/package.json",
  "packages/shared-ui/package.json",
  "packages/web/package.json",
];
const packages = [];
for (const file of packageFiles) packages.push(await readJson(file));
const versions = new Set(packages.map((pkg) => pkg.version));
if (versions.size !== 1) fail("workspace package versions are inconsistent: " + [...versions].join(", "));
if ([...versions][0] !== rootPackage.version) fail("root/package versions are inconsistent");

const requiredScripts = [
  "verify:workspace",
  "verify:ipc",
  "verify:release",
  "test:performance",
  "test:runtime",
  "test:e2e",
];
for (const script of requiredScripts) {
  if (typeof rootPackage.scripts?.[script] !== "string") fail("missing root script: " + script);
}

const productionRoots = [
  "packages/core/src",
  "packages/desktop/src",
  "packages/mobile",
  "packages/web/src",
  "packages/shared-ui/src",
];
const forbidden = /\b(TODO|FIXME|HACK|XXX)\b/i;
const forbiddenPlaceholder = /\b(?:PLACEHOLDER|CHANGE_ME|YOUR_[A-Z_]+|MY_[A-Z_]+|TBD)\b/;
const ignored = new Set(["node_modules", ".git", ".next", "out", "dist", "build", ".turbo", ".expo"]);
let scanned = 0;

async function scan(dir) {
  for (const entry of await readdir(join(root, dir), { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await scan(path);
      continue;
    }
    if (!/\.(?:ts|tsx|mjs|cjs|js)$/.test(entry.name)) continue;
    const content = await readFile(join(root, path), "utf8");
    scanned += 1;
    if (forbidden.test(content)) fail("production TODO/FIXME marker detected in " + path);
    if (forbiddenPlaceholder.test(content)) fail("production placeholder token detected in " + path);
  }
}

for (const rootDir of productionRoots) await scan(rootDir);

const status = execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim();
if (status) fail("working tree is dirty in CI/release environment");

console.log(JSON.stringify({
  status: "passed",
  version: rootPackage.version,
  packageManager: rootPackage.packageManager,
  scannedProductionFiles: scanned,
  lockfiles: ["pnpm-lock.yaml", "packages/desktop/src-tauri/Cargo.lock"],
}));
