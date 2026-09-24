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

The Vercel project `orbit-marketing-os` is connected and receives deployments from `rebuild/orbit-production`.

The latest verified deployment diagnostics identified and then addressed these configuration failures:

1. `ignoreCommand` exceeded Vercel's 256-character schema limit.
2. The shortened command then failed when `VERCEL_GIT_PREVIOUS_SHA` was empty and `git diff` received an empty revision.

The repository `vercel.json` has now been hardened so missing Git revision context does not produce a fatal `bad revision` error. A successful deployment still requires a fresh deployment result after this fix.

The project metadata previously reported framework `vite` while the repository deployment contract targets Next.js static output. This remains a project-configuration verification item until a successful deployment confirms the effective build settings.

## 4. Reproducible release blocker

`pnpm-lock.yaml` is still absent from the rebuild branch. This is intentional: no lockfile is being fabricated. Bootstrap scripts/workflow exist to generate it on an owned runner, after which frozen installs become the release path.

## Release consequence

Do not merge PR #2 or claim production readiness while clean install, TypeScript checks, Rust checks, runtime integration, E2E, security, performance, signing, distribution, and other applicable release gates remain unverified.
