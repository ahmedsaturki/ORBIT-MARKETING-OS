import { readFile, stat } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const text = async (relative) => readFile(new URL(relative, root), "utf8");
const json = async (relative) => JSON.parse(await text(relative));

const rootPackage = await json("package.json");
const packages = await Promise.all([
  json("packages/core/package.json"),
  json("packages/desktop/package.json"),
  json("packages/mobile/package.json"),
  json("packages/shared-ui/package.json"),
  json("packages/web/package.json"),
]);

const expectedVersion = rootPackage.version;
if (!/^\d+\.\d+\.\d+$/.test(expectedVersion)) {
  throw new Error("Root package version must be semver: " + expectedVersion);
}

for (const pkg of packages) {
  if (pkg.version !== expectedVersion) {
    throw new Error("Package " + pkg.name + " version " + pkg.version + " does not match root " + expectedVersion);
  }
}

const cargo = await text("packages/desktop/src-tauri/Cargo.toml");
const cargoVersion = cargo.match(/^version = "([^"]+)"/m)?.[1];
if (cargoVersion !== expectedVersion) {
  throw new Error("Cargo version " + (cargoVersion ?? "missing") + " does not match root " + expectedVersion);
}

const vercel = await json("vercel.json");
if (vercel.framework !== "nextjs") throw new Error("Vercel framework must be nextjs");
if (vercel.outputDirectory !== "packages/web/out") throw new Error("Vercel outputDirectory drift detected");
if (vercel.buildCommand !== "pnpm --dir packages/web build") throw new Error("Vercel buildCommand drift detected");
if (vercel.installCommand !== "bash scripts/vercel-install.sh") throw new Error("Vercel installCommand drift detected");
if (vercel.ignoreCommand !== "bash scripts/vercel-ignore.sh") throw new Error("Vercel ignoreCommand drift detected");
if (vercel.git?.deploymentEnabled !== false) throw new Error("Automatic Git Vercel deployments must remain disabled");

const requiredFiles = [
  "pnpm-lock.yaml",
  "packages/desktop/src-tauri/Cargo.lock",
  "rust-toolchain.toml",
  ".github/workflows/ci.yml",
  ".github/workflows/self-hosted-verify.yml",
  ".github/workflows/bootstrap-lockfile.yml",
  ".github/workflows/vercel-web.yml",
  "scripts/self-hosted-preflight.sh",
  "scripts/security-scan.mjs",
];

for (const relative of requiredFiles) {
  try {
    const info = await stat(new URL(relative, root));
    if (!info.isFile() || info.size === 0) throw new Error("empty");
  } catch {
    throw new Error("Missing required release file: " + relative);
  }
}

const rustToolchain = await text("rust-toolchain.toml");
if (!rustToolchain.includes('channel = "1.98.1"')) {
  throw new Error("Rust toolchain drift detected");
}

const ci = await text(".github/workflows/ci.yml");
if (!ci.includes("pnpm install --frozen-lockfile")) throw new Error("CI frozen install gate missing");
if (!ci.includes("pnpm audit --audit-level=high")) throw new Error("CI dependency audit gate missing");
if (!ci.includes("pnpm security:scan")) throw new Error("CI secret scan gate missing");
if (!ci.includes("pnpm test:performance")) throw new Error("CI performance smoke gate missing");
if (!ci.includes("pnpm test:e2e")) throw new Error("CI browser E2E gate missing");

const vercelWorkflow = await text(".github/workflows/vercel-web.yml");
for (const fragment of [
  "vercel@59.23.1 pull --yes",
  "vercel@59.23.1 deploy --dry --format=json",
  "vercel@59.23.1 build --prod",
  "vercel@59.23.1 deploy --prebuilt --prod",
]) {
  if (!vercelWorkflow.includes(fragment)) throw new Error("Vercel deployment gate missing: " + fragment);
}

const selfHosted = await text(".github/workflows/self-hosted-verify.yml");
for (const fragment of [
  "runs-on: [self-hosted, x64, linux]",
  "github.ref_name == 'rebuild/orbit-production' && github.actor == 'ahmedsaturki'",
  "run: bash scripts/self-hosted-preflight.sh",
  "pnpm install --frozen-lockfile",
  "pnpm --filter @orbit/core test:coverage",
  "pnpm test:runtime",
  "pnpm test:performance",
  "pnpm test:e2e",
  "cargo fmt --all -- --check",
  "cargo test --workspace --all-targets",
  "cargo clippy --workspace --all-targets -- -D warnings",
]) {
  if (!selfHosted.includes(fragment)) throw new Error("Self-hosted verification gate missing: " + fragment);
}

const bootstrap = await text(".github/workflows/bootstrap-lockfile.yml");
for (const fragment of [
  "runs-on: [self-hosted, x64, linux]",
  "github.ref_name == 'rebuild/orbit-production' && github.actor == 'ahmedsaturki'",
  "run: bash scripts/self-hosted-preflight.sh",
  "pnpm install --lockfile-only --ignore-scripts",
  "cargo generate-lockfile",
  "node scripts/commit-lockfiles.mjs",
]) {
  if (!bootstrap.includes(fragment)) throw new Error("Lockfile bootstrap contract missing: " + fragment);
}

const commitLockfiles = await text("scripts/commit-lockfiles.mjs");
for (const fragment of [
  "GITHUB_REF_NAME",
  "rebuild/orbit-production",
  'execFileSync("git", ["add"',
  'execFileSync("git", ["commit"',
  'execFileSync("git", ["push"',
]) {
  if (!commitLockfiles.includes(fragment)) throw new Error("Canonical lockfile commit contract missing: " + fragment);
}

console.log("ORBIT release sanity passed for version " + expectedVersion);
