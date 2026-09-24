$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js 22+ is required."
}
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  throw "pnpm 10.17.1 is required."
}
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
  throw "Rust/Cargo 1.98.1 is required."
}

$pnpmVersion = (pnpm --version).Trim()
if ($pnpmVersion -ne "10.17.1") {
  throw "Expected pnpm 10.17.1, found $pnpmVersion"
}

pnpm install --lockfile-only --ignore-scripts
cargo generate-lockfile --manifest-path "packages/desktop/src-tauri/Cargo.toml"

if (-not (Test-Path "pnpm-lock.yaml")) {
  throw "pnpm-lock.yaml was not generated."
}
if (-not (Test-Path "packages/desktop/src-tauri/Cargo.lock")) {
  throw "packages/desktop/src-tauri/Cargo.lock was not generated."
}

pnpm verify:workspace
pnpm install --frozen-lockfile

Write-Host "Reproducible lockfile bootstrap complete. Review pnpm-lock.yaml and packages/desktop/src-tauri/Cargo.lock, then commit both."
