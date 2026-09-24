# Verification Blockers

Updated: 2026-09-24

## GitHub Actions runner blocker

The rebuild branch is generating GitHub Actions runs, but the hosted jobs fail before the first workflow step is registered.

Observed on the current rebuild sequence:

- CI jobs report `failure` with `steps: []`.
- Rust jobs report `failure` with `steps: []`.
- A deliberately minimal Runner Probe containing only a shell `echo` plus version checks also failed before any step executed.
- The affected job metadata reports no assigned runner (`runner_id=0`, empty runner name).

This proves the current failure is not evidence that ORBIT TypeScript or Rust compilation failed. It is an Actions execution-infrastructure blocker.

The repository therefore must not convert these failures into a product `FAIL` verdict. The release gate remains `UNVERIFIED` until a real runner executes the workflow.

## Local environment limitation

The current working environment cannot resolve GitHub's host through its shell networking, so a second independent clean checkout could not be created locally. No dependency lockfile or build result is being fabricated from that limitation.

## Release consequence

Do not merge PR #2 or claim production readiness while clean install, TypeScript checks, Rust checks, runtime integration, E2E, security, performance, packaging, and distribution evidence remain unverified.

## Vercel dependency-fetch blocker

The connected Vercel project `orbit-marketing-os` is receiving deployments from `rebuild/orbit-production`.

The deployment pipeline was narrowed from full-workspace install to:

`pnpm install --filter @orbit/web --no-frozen-lockfile`

and the extra Corepack download step was removed. Vercel still reports `ERR_PNPM_META_FETCH_FAIL` at `buildStep`, with the install command exiting 1.

Therefore the current Vercel evidence does not prove a TypeScript/Next.js compile failure. It proves dependency metadata could not be fetched during the Vercel install stage.

The Vercel project metadata also currently reports framework `vite`, while the intended deploy target is `packages/web` as a Next.js static export. Source `vercel.json` explicitly sets the Next.js build command and output directory, but a project-level Root Directory/Framework setting may still need to be corrected in Vercel before final production deployment.
