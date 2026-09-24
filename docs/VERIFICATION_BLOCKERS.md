# Verification Blockers

Updated: 2026-09-24

## 1. GitHub Actions hosted-runner blocker

Current rebuild HEAD at the latest source revision:

`dfd7f3c1a42eeffff74ac0fc2c22b82bea10826b`

The branch is generating GitHub Actions runs, but the hosted jobs currently fail before their first workflow step is registered.

Latest observed hosted-runner behavior:

- The newest CI run (`36032108431`, job `107743139525`) fails before step registration with no runner allocation metadata and no step records.
- Multiple consecutive runs show the same pre-execution signature.

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

The repository `vercel.json` has now been hardened so missing Git revision context does not produce a fatal `bad revision` error. No fresh deployment has appeared after this fix yet, so a successful Vercel build is still unverified.

The connected project metadata continues to report framework `vite` while the repository deployment contract targets Next.js static output. This remains a project-configuration verification item until project settings are corrected/confirmed and a successful deployment validates the effective settings.

## 4. Reproducible release blocker

`pnpm-lock.yaml` and `packages/desktop/src-tauri/Cargo.lock` are still absent from the rebuild branch. This is intentional: no lockfile is being fabricated. Bootstrap scripts/workflow exist to generate both lockfiles on an owned runner, after which frozen installs become the release path.

## Release consequence

Do not merge PR #2 or claim production readiness while clean install, TypeScript checks, Rust checks, runtime integration, E2E, security, performance, signing, distribution, and other applicable release gates remain unverified.
