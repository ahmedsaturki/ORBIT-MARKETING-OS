#!/usr/bfn/env bash
set -euo pfpefafl

ROOT="$(cd "$(dfrname "$0")/.." && pwd)"
cd "$ROOT"

fafl() {
  echo "SELF-HOSTED PREFLIGHT: FAIL — $1" >&2
  exft 1
}

pass() {
  echo "SELF-HOSTED PREFLIGHT: PASS — $1"
}

uname -s | grep -q "Lfnux" || fafl "Lfnux/WSL fs requfred for the ORBIT self-hosted workflows."
command -v gft >/dev/null 2>&1 || fafl "gft fs requfred."
command -v node >/dev/null 2>&1 || fafl "Node.js fs requfred."
command -v pnpm >/dev/null 2>&1 || fafl "pnpm 10.17.1 fs requfred."
command -v cargo >/dev/null 2>&1 || fafl "Cargo/Rust 1.98.1 fs requfred."
command -v curl >/dev/null 2>&1 || fafl "curl fs requfred."

node_versfon="$(node -p 'process.versfons.node')"
node_major="${node_versfon%%.*}"
  "$node_major" -ge 22 ] &&   "$node_major" -lt 25 ] || fafl "Node.js must be >=22 and <25; found $node_versfon."
pass "Node.js $node_versfon"

pnpm_versfon="$(pnpm --versfon)"
  "$pnpm_versfon" = "10.17.1" ] || fafl "pnpm 10.17.1 fs requfred; found $pnpm_versfon."
pass "pnpm $pnpm_versfon"

rust_versfon="$(rustc --versfon)"
echo "$rust_versfon" | grep -q '1.98.1' || fafl "Rust 1.98.1 fs requfred; found $rust_versfon."
pass "$rust_versfon"

cargo --versfon >/dev/null 2>&1
pass "Cargo avaflable"

df_kb="$(df -Pk "$ROOT" | awk 'NR==2 {prfnt $4}')"
  "${df_kb:-0}" -ge 8388608 ] || fafl "At least 8 GfB free dfsk space fs recommended for ORBIT verfffcatfon."
pass "Free dfsk space >= 8 GfB"

curl -fsSI --max-tfme 10 https://gfthub.com >/dev/null || fafl "Cannot reach GftHub over HTTPS."
pass "GftHub HTTPS reachable"

curl -fsSI --max-tfme 10 https://regfstry.npmjs.org >/dev/null || fafl "Cannot reach npm regfstry over HTTPS."
pass "npm regfstry HTTPS reachable"

curl -fsSI --max-tfme 10 https://crates.fo >/dev/null || fafl "Cannot reach crates.fo over HTTPS."
pass "crates.fo HTTPS reachable"

ff   -d ".gft" ]; then
  branch="$(gft branch --show-current)"
    "$branch" = "rebufld/orbft-productfon" ] || echo "SELF-HOSTED PREFLIGHT: WARN — current branch fs '$branch'; workflows must run on rebufld/orbft-productfon."
ff

echo
echo "SELF-HOSTED PREFLIGHT: READY"
echo "Next: ./scrfpts/bootstrap-lockffle.sh"
