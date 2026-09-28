import { readFile, stat } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const text = async (relative) => readFile(new URL(relative, root), "utf8");
const json = async (relative) => JSON.parse(await text(relative));

const rootPackage = await json("package.json");
for (const script of [
  "verify:workspace",
  "verify:ipc",
  "verify:release",
  "security:scan",
  "test:runtime",
  "test:performance",
  "test:e2e",
  "soak",
  "release:evidence",
  "test:recovery:evidence",
  "test:release-evidence-collector",
]) {
  if (typeof rootPackage.scripts?.[script] !== "string") {
    throw new Error("Root package script is missing: " + script);
  }
}

const packages = await Promise.all([
  json("packages/core/package.json"),
  json("packages/desktop/package.json"),
  json("packages/mobile/package.json"),
  json("packages/shared-ui/package.json"),
  json("packages/web/package.json"),
]);

const expectedVersion = rootPackage.version;
const productionRelease = await json("release/PRODUCTION_RELEASE.json");
if (
  productionRelease.schemaVersion !== 1 ||
  typeof productionRelease.releaseId !== "string" ||
  !/^[A-Za-z0-9._-]{1,100}$/.test(productionRelease.releaseId) ||
  productionRelease.mode !== "EXPLICIT_PRODUCTION_RELEASE"
) {
  throw new Error("Invalid production release marker");
}
if (!/^\d+\.\d+\.\d+$/.test(expectedVersion)) {
  throw new Error("Root package version must be semver: " + expectedVersion);
}

for (const pkg of packages) {
  if (pkg.version !== expectedVersion) {
    throw new Error(
      "Package " +
        pkg.name +
        " version " +
        pkg.version +
        " does not match root " +
        expectedVersion,
    );
  }
}

const cargo = await text("packages/desktop/src-tauri/Cargo.toml");
const cargoVersion = cargo.match(/^version = "([^"]+)"/m)?.[1];
if (cargoVersion !== expectedVersion) {
  throw new Error(
    "Cargo version " +
      (cargoVersion ?? "missing") +
      " does not match root " +
      expectedVersion,
  );
}

const vercel = await json("vercel.json");
if (!["nextjs", null].includes(vercel.framework))
  throw new Error(
    "Vercel framework must be Next.js/null for the static export",
  );
if (vercel.outputDirectory !== "packages/web/out")
  throw new Error("Vercel outputDirectory drift detected");
if (vercel.buildCommand !== "pnpm --dir packages/web build")
  throw new Error("Vercel buildCommand drift detected");
if (vercel.installCommand !== "bash scripts/vercel-install.sh")
  throw new Error("Vercel installCommand drift detected");
if (vercel.ignoreCommand !== "bash scripts/vercel-ignore.sh")
  throw new Error("Vercel ignoreCommand drift detected");
const deploymentEnabled = vercel.git?.deploymentEnabled;
const governedMainGitDeployment =
  typeof deploymentEnabled === "object" &&
  deploymentEnabled !== null &&
  deploymentEnabled["*"] === false &&
  deploymentEnabled.main === true;
if (deploymentEnabled !== false && !governedMainGitDeployment)
  throw new Error(
    "Vercel Git deployments must be disabled except for governed main",
  );

const requiredFiles = [
  "pnpm-lock.yaml",
  "packages/desktop/src-tauri/Cargo.lock",
  "rust-toolchain.toml",
  ".github/workflows/ci.yml",
  ".github/workflows/self-hosted-verify.yml",
  ".github/workflows/bootstrap-lockfile.yml",
  ".github/workflows/vercel-web.yml",
  ".github/workflows/web-release-selfhosted.yml",
  "scripts/self-hosted-preflight.sh",
  "scripts/security-scan.mjs",
  "scripts/performance-smoke.mjs",
  "scripts/soak.ts",
  "scripts/verify-live-web.mjs",
  "scripts/vercel-ignore.test.mjs",
  "scripts/test-git-fixture.mjs",
  "scripts/production-release-trigger.test.mjs",
  "scripts/resolve-production-release.mjs",
  "release/PRODUCTION_RELEASE.json",
  "docs/PRODUCTION_RELEASES.md",
  "scripts/recovery-evidence.mjs",
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
if (!ci.includes("pnpm install --frozen-lockfile"))
  throw new Error("CI frozen install gate missing");
if (!ci.includes("pnpm audit --audit-level=moderate"))
  throw new Error("CI dependency audit gate missing");

const desktopRelease = await text(".github/workflows/release-desktop.yml");
const mobileRelease = await text(".github/workflows/release-mobile.yml");
const webRelease = await text(".github/workflows/web-release-selfhosted.yml");
for (const [name, workflow] of [
  ["desktop release", desktopRelease],
  ["mobile release", mobileRelease],
  ["self-hosted web release", webRelease],
]) {
  if (!workflow.includes("pnpm audit --audit-level=moderate")) {
    throw new Error(`${name} dependency audit gate missing`);
  }
  if (workflow.includes("pnpm audit --audit-level=high")) {
    throw new Error(`${name} still allows a high-only dependency audit`);
  }
}

if (!ci.includes("pnpm security:scan"))
  throw new Error("CI secret scan gate missing");
if (!ci.includes("pnpm test:performance"))
  throw new Error("CI performance smoke gate missing");
if (!ci.includes("pnpm test:e2e"))
  throw new Error("CI browser E2E gate missing");
if (!ci.includes("node scripts/vercel-ignore.test.mjs"))
  throw new Error("Vercel ignore-command contract test missing");
if (!ci.includes("node scripts/production-release-trigger.test.mjs"))
  throw new Error("Production release trigger contract test missing");
if (!ci.includes("pnpm test:recovery:evidence"))
  throw new Error("Recovery evidence CI gate missing");
if (!ci.includes("if: ${{ !cancelled() }}"))
  throw new Error(
    "Recovery evidence artifact failure upload condition missing",
  );
if (
  !ci.includes(
    "orbit-recovery-evidence-${{ github.event.pull_request.head.sha || github.sha }}",
  )
)
  throw new Error("Recovery evidence artifact SHA selection missing");

const selfHostedWeb = await text(
  ".github/workflows/web-release-selfhosted.yml",
);
for (const fragment of [
  "runs-on: [self-hosted, x64, linux]",
  "github.ref_name == 'main'",
  "Require explicit production release",
  "scripts/resolve-production-release.mjs",
  "pnpm install --frozen-lockfile",
  "pnpm security:scan",
  "vercel@59.23.1 build --prod",
  "vercel@59.23.1 deploy --prebuilt --prod",
  "node scripts/verify-live-web.mjs",
]) {
  if (!selfHostedWeb.includes(fragment))
    throw new Error("Self-hosted web release gate missing: " + fragment);
}

const vercelWorkflow = await text(".github/workflows/vercel-web.yml");
const productionResolver = await text(
  "scripts/resolve-production-release.mjs",
);
if (productionResolver.includes("GITHUB_OUTPUT")) {
  throw new Error(
    "Production release resolver must not write directly to GitHub output paths",
  );
}

for (const fragment of [
  "scripts/resolve-production-release.mjs",
  "needs.release_trigger.outputs.triggered",
  "github.sha",
  "vercel@59.23.1 pull --yes",
  "vercel@59.23.1 deploy --dry --format=json",
  "vercel@59.23.1 build --prod",
  "vercel@59.23.1 deploy --prebuilt --prod",
]) {
  if (!vercelWorkflow.includes(fragment))
    throw new Error("Vercel deployment gate missing: " + fragment);
}

const vercelProvenanceWorkflow = await text(
  ".github/workflows/vercel-production-provenance.yml",
);
for (const [name, workflow] of [
  ["Vercel web workflow", vercelWorkflow],
  ["Vercel production provenance workflow", vercelProvenanceWorkflow],
  ["Self-hosted web release workflow", selfHostedWeb],
]) {
  if (/\npermissions:\n  contents: read\n/.test(workflow)) {
    throw new Error(name + " must scope permissions at job level");
  }
}

for (const fragment of [
  "release/PRODUCTION_RELEASE.json",
  "scripts/resolve-production-release.mjs",
  "release_active=true",
  "release_current=true",
]) {
  if (!vercelProvenanceWorkflow.includes(fragment))
    throw new Error("Vercel provenance gate missing: " + fragment);
}

const selfHosted = await text(".github/workflows/self-hosted-verify.yml");
for (const fragment of [
  "runs-on: [self-hosted, x64, linux]",
  "(github.ref_name == 'rebuild/orbit-production' || github.ref_name == 'rebuild/orbit-production-consolidated' || github.ref_name == 'rebuild/orbit-production-final') && github.actor == 'ahmedsaturki'",
  "run: bash scripts/self-hosted-preflight.sh",
  "pnpm install --frozen-lockfile",
  "pnpm --filter @orbit/core test:coverage",
  "pnpm test:runtime",
  "pnpm test:performance",
  "pnpm test:e2e",
  "cargo fmt --all -- --check",
  "cargo test --locked --workspace --all-targets",
  "cargo clippy --locked --workspace --all-targets -- -D warnings",
]) {
  if (!selfHosted.includes(fragment))
    throw new Error("Self-hosted verification gate missing: " + fragment);
}

const bootstrap = await text(".github/workflows/bootstrap-lockfile.yml");
for (const fragment of [
  "runs-on: [self-hosted, x64, linux]",
  "(github.ref_name == 'rebuild/orbit-production' || github.ref_name == 'rebuild/orbit-production-consolidated' || github.ref_name == 'rebuild/orbit-production-final') && github.actor == 'ahmedsaturki'",
  "run: bash scripts/self-hosted-preflight.sh",
  "pnpm install --lockfile-only --ignore-scripts",
  "cargo generate-lockfile",
  "node scripts/commit-lockfiles.mjs",
]) {
  if (!bootstrap.includes(fragment))
    throw new Error("Lockfile bootstrap contract missing: " + fragment);
}

const commitLockfiles = await text("scripts/commit-lockfiles.mjs");
for (const fragment of [
  "GITHUB_REF_NAME",
  "rebuild/orbit-production",
  "rebuild/orbit-production-consolidated",
  "rebuild/orbit-production-final",
]) {
  if (!commitLockfiles.includes(fragment))
    throw new Error("Canonical lockfile commit contract missing: " + fragment);
}
for (const [name, pattern] of [
  ["git add", /execFileSync\(\s*"git"\s*,\s*\[\s*"add"/],
  ["git commit", /execFileSync\(\s*"git"\s*,\s*\[\s*"commit"/],
  ["git push", /execFileSync\(\s*"git"\s*,\s*\[\s*"push"/],
]) {
  if (!pattern.test(commitLockfiles))
    throw new Error("Canonical lockfile commit contract missing: " + name);
}

console.log("ORBIT release sanity passed for version " + expectedVersion);
