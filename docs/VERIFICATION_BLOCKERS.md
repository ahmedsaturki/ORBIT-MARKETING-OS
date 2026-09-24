# Verification Blockers

Updated: 2026-09-24

## 1. GitHub Actions hosted-runner blocker

Current rebuild HEAD:

`d51687d07dea96f61f509804f590df6e6ee40fca`

The branch is generating GitHub Actions runs, but the hosted jobs currently fail before their first workflow step is registered.

Latest observed runs:

- CI: `36001357506` → completed / failure.
- Rebuild Rust: `36001357473` → completed / failure.
- Their associated jobs report `steps: []`.
- Job metadata reports `runner_id=0` and an empty runner name.

A deliberately minimal runner probe was also tested earlier and failed before any workflow step executed. It was removed after diagnosis.

**Interpretation:** these runs are execution-infrastructure evidence, not TypeScript/Rust compilation evidence. They must remain a technical verification blocker until a real runner executes the workflow.

## 2. Local network limitation

The current source environment cannot resolve GitHub/npm through shell networking, so a second independent clean checkout could not be created locally. A real `pnpm-lock.yaml` has not been fabricated.

The repository now provides:

- `scripts/bootstrap-lockfile.ps1` for Windows.
- `scripts/bootstrap-lockfile.sh` for Linux/WSL/macOS.
- `.github/workflows/self-hosted-verify.yml` as a manual full verification path on an owned runner.

## 3. Vercel deployment evidence

The Vercel project `orbit-marketing-os` exists in the connected Vercel team.

The last concrete deployment evidence inspected before the current release-control hardening was an ERROR caused by `ERR_PNPM_META_FETCH_FAIL` during dependency installation. That deployment is not treated as proof of a source build failure.

The repository Vercel configs now:

- require `pnpm install --frozen-lockfile`;
- fail closed when the committed lockfile is absent;
- target Next.js;
- use the `packages/web` static output contract.

The Vercel project-level settings still require external verification against the intended `packages/web` + Next.js deployment target.

## Release consequence

Do not merge PR #2 or claim production readiness while clean install, TypeScript checks, Rust checks, runtime integration, E2E, security, performance, signing, distribution, and other applicable release gates remain unverified.

