#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail() {
  echo "SELF-HOSTED PREFLIGHT: FAIL — $1" >&2
  exit 1
}

pass() {
  echo "SELF-HOSTED PREFLIGHT: PASS — $1"
}

uname -s | grep -q "Linux" || fail "Linux/WSL is required for the ORBIT self-hosted workflows."
command -v git >/dev/null 2>&1 || fail "git is required."
command -v node >/dev/null 2>&1 || fail "Node.js is required."
command -v pnpm >/dev/null 2>&1 || fail "pnpm 10.17.1 is required."
command -v cargo >/dev/null 2>&1 || fail "Cargo/Rust 1.98.1 is required."
command -v curl >/dev/null 2>&1 || fail "curl is required."

node_version="$(node -p 'process.versions.node')"
node_major="${node_version%%.*}"
[ "$node_major" -ge 22 ] && [ "$node_major" -lt 25 ] || fail "Node.js must be >=22 and <25; found $node_version."
pass "Node.js $node_version"

pnpm_version="$(pnpm --version)"
[ "$pnpm_version" = "10.17.1" ] || fail "pnpm 10.17.1 is required; found $pnpm_version."
pass "pnpm $pnpm_version"

rust_version="$(rustc --version)"
echo "$rust_version" | grep -q '1.98.1' || fail "Rust 1.98.1 is required; found $rust_version."
pass "$rust_version"

cargo --version >/dev/null 2>&1
pass "Cargo available"

df_kb="$(df -Pk "$ROOT" | awk 'NR==2 {print $4}')"
[ "${df_kb:-0}" -ge 8388608 ] || fail "At least 8 GiB free disk space is recommended for ORBIT verification."
pass "Free disk space >= 8 GiB"

curl -fsSI --max-time 10 https://github.com >/dev/null || fail "Cannot reach GitHub over HTTPS."
pass "GitHub HTTPS reachable"

curl -fsSI --max-time 10 https://registry.npmjs.org >/dev/null || fail "Cannot reach npm registry over HTTPS."
pass "npm registry HTTPS reachable"

curl -fsSI --max-time 10 https://crates.io >/dev/null || fail "Cannot reach crates.io over HTTPS."
pass "crates.io HTTPS reachable"

if [ -d ".git" ]; then
  branch="$(git branch --show-current)"
  [ "$branch" = "rebuild/orbit-production" ] || echo "SELF-HOSTED PREFLIGHT: WARN — current branch is '$branch'; workflows must run on rebuild/orbit-production."
fi

echo
echo "SELF-HOSTED PREFLIGHT: READY"
echo "Next: ./scripts/bootstrap-lockfile.sh"
