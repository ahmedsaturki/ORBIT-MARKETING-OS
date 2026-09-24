# Verification Blockers

Updated: 2026-09-24

## 1. GitHub Actions hosted-runner blocker

Current rebuild HEAD at the latest source revision:

`8904f23766b502525bbcb7d3dee825687ff914f0`

The branch is generating GitHub Actions runs, but the hosted jobs currently fail before their first workflow step is registered.

Latest observed hosted-runner behavior:

- The newest hosted CI run on the consolidated line (`36055292748`) failed before any workflow step executed; the job record has no usable steps/logs.
- A self-hosted verification run (`36055285400`) is now queued against the exact consolidation HEAD `8904f23766b502525bbcb7d3dee825687ff914f0` and awaits a matching `self-hosted, x64, linux` runner.

A deliberately minimal runner probe was also tested earlier and failed before any workflow step executed. It was removed after diagnosis.

**Interpretation:** these runs are execution-infrastructure evidence, not TypeScript/Rust compilation evidence. They must remain a technical verification blocker until a real runner executes the workflow.

## 2. Local network limitation

The current source environment cannot resolve GitHub/npm through shell networking, so a second independent clean checkout could not be created locally. A real `pnpm-lock.yaml` has not been fabricated.

The repository now provides:

- `scripts/bootstrap-lockfile.ps1` for Windows.
- `scripts/bootstrap-lockfile.sh` for Linux/WSL/macOS.
- `.github/workflows/self-hosted-verify.yml` as the full verification path (push/manual) on an owned runner.

## 3. Vercel deployment evidence

The Vercel project `orbit-marketing-os` is connected. Automatic Git builds are disabled repository-side; the intended release path is guarded prebuilt deployment.

The latest verified deployment diagnostics identified and then addressed these configuration failures:

1. `ignoreCommand` exceeded Vercel's 256-character schema limit.
2. The shortened command then failed when `VERCEL_GIT_PREVIOUS_SHA` was empty and `git diff` received an empty revision.

The repository `vercel.json` has now been hardened so missing Git revision context does not produce a fatal `bad revision` error. Automatic Git deployments are now disabled repository-side. The connected deployment status is clear on the current source snapshot; successful prebuilt production deployment remains unverified.

The connected project metadata has reported framework `vite` while the repository deployment contract targets Next.js static output. This remains a project-configuration verification item until project settings are corrected/confirmed and a successful deployment validates the effective settings.

## 4. Reproducible release blocker

`pnpm-lock.yaml` and `packages/desktop/src-tauri/Cargo.lock` are still absent from the rebuild branch. This is intentional: no lockfile is being fabricated. Bootstrap scripts/workflow exist to generate both lockfiles on an owned runner, after which frozen installs become the release path.

## Release consequence

Do not merge PR #9 or claim production readiness while clean install, TypeScript checks, Rust checks, runtime integration, E2E, security, performance, signing, distribution, and other applicable release gates remain unverified.
