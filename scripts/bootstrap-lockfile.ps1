$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js 22+ is required."
}
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  throw "pnpm 10.17.1 is required."
}

$pnpmVersion = (pnpm --version).Trim()
if ($pnpmVersion -ne "10.17.1") {
  throw "Expected pnpm 10.17.1, found $pnpmVersion"
}

pnpm install --lockfile-only --ignore-scripts
if (-not (Test-Path "pnpm-lock.yaml")) {
  throw "pnpm-lock.yaml was not generated."
}

pnpm verify:workspace
pnpm install --frozen-lockfile

Write-Host "Lockfile bootstrap complete. Review pnpm-lock.yaml, then commit it."
