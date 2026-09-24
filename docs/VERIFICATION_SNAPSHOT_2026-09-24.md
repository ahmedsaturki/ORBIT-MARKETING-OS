# ORBIT Verification Snapshot — 2026-09-24

## Current source head

- Branch: `rebuild/orbit-production`
- HEAD: `a5c163df9adca5b6e2591b274a64e0a9f44cebf3`
- PR #2: open, draft, unmerged

## Source-level repairs completed in this tranche

1. Removed duplicate Rust derive attributes that could stop compilation.
2. Repaired the malformed Rust rule-pack test string literal.
3. Added the missing `workspace_id` fixture in the audit hash-chain test.
4. Updated native account upsert logic so the persisted authorization status follows the submitted status, with a regression test.
5. Normalized task scheduling timestamps to UTC RFC3339 before persistence/claim comparison.
6. Bounded native task `max_attempts` to 1..=10 and added regression coverage.
7. Updated the LinkedIn connector default API version to 202609.
8. Strengthened workspace verification to detect duplicate consecutive Rust derive attributes.

## Execution evidence

- GitHub Actions latest CI run for this branch reached a job with `runner_id=0`, no runner name, and zero registered steps, then failed before executing the first workflow step.
- A self-hosted lockfile-bootstrap run remains an external execution prerequisite; no committed `pnpm-lock.yaml` exists yet.
- Local shell verification cannot manufacture a reproducible lockfile because the execution environment has no working npm registry access and does not have pnpm installed.
- No successful clean TypeScript/Rust/browser/build evidence is claimed from this environment.

## Vercel

- Project: `orbit-marketing-os`
- Project ID: `prj_XL2WKssI4tzw4Wd5OQw4Pb1v6dMt`
- Repository-side Vercel configuration targets a Next.js static export at `packages/web/out`.
- The connected project metadata has reported framework `vite`, so effective project settings still require verification.
- The latest observed rebuild deployment failed at the install step because the repository did not contain `pnpm-lock.yaml`.
- No successful production deployment is claimed.

## Release state

Production launch remains blocked until the reproducible install/lockfile gate and actual clean-environment execution gates pass. Desktop/mobile signing and commercial payment configuration remain separate release prerequisites.

## LinkedIn compatibility note

LinkedIn's current Marketing API documentation lists version `202609` (September 2026) as the active release, with versioned REST requests using the `Linkedin-Version: YYYYMM` header. ORBIT now defaults its LinkedIn connector to `202609`.
