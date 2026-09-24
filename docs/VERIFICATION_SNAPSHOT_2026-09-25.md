# ORBIT Verification Snapshot — 2026-09-25

## Source
- Branch: `rebuild/orbit-production`
- HEAD: `2115d3bf43fbdb53b500c3de642f42ff47d679df`
- PR #2: open, draft, unmerged

## Source hardening completed
- Rust duplicate-derive and malformed-test-string compile blockers fixed.
- Account upsert authorization state synchronized with persisted session state.
- Account API result now reports persisted encrypted-session presence.
- Native task timestamps normalized to UTC RFC3339.
- Native retry limits bounded and rule-pack retry ceilings cannot exceed task limits.
- Approval request/decision actors are bound to the local runtime identity.
- LinkedIn connector default API version is `202609`.
- Workspace verification detects duplicate consecutive Rust derive attributes.
- LAN runtime rate limiting now occurs before bearer-token validation, covering invalid-token brute-force attempts.

## Execution status
The latest rebuild CI attempts continue to fail before workflow steps execute, with GitHub Actions jobs reporting no runner allocation (`runner_id=0`, empty runner name, `steps=[]`). Therefore no fresh clean TypeScript/Rust/browser/build PASS is claimed.

## Lockfiles
- `pnpm-lock.yaml`: absent
- `packages/desktop/src-tauri/Cargo.lock`: absent

Both are intentionally generated only by the reproducible bootstrap flow on an owned runner. No lockfile is fabricated.

## Vercel
The connected project is `orbit-marketing-os`. Repository-side deployment configuration targets:
- Next.js
- build command `pnpm --dir packages/web build`
- output `packages/web/out`
- guarded frozen install
- automatic Git deployment disabled

A fresh successful rebuild deployment is still not verified. The latest concrete rebuild deployment remained an install-stage ERROR caused by the absent committed lockfile.

## Current external-version checks
- Next.js `16.3.6` is the current Active LTS patch as of the September 22, 2026 security release. citeturn456501search0turn456501search2
- Expo SDK `57.0.24` is the current SDK 57 release line used here; SDK 57 carries React Native 0.86, with later SDK 57 patches resolving Hermes regressions. citeturn970656search0turn387120search5
- LinkedIn Marketing API version `202609` is active for September 2026 and uses the `Linkedin-Version: YYYYMM` request header. citeturn673555search3turn673555search6
- Vercel CLI `59.23.1` is currently published and is the pinned CLI used by the release workflow. citeturn965719search1

## Release consequence
Production launch, commercial billing, signed artifacts, and live connector claims remain gated on current execution evidence and their respective external prerequisites.
