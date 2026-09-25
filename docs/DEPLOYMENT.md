# ORBIT Marketing OS — Deployment

## Web / Vercel

The web package is a static Next.js export into `packages/web/out`. For a local smoke preview, serve that directory with any static HTTP server (for example Python's built-in `http.server`); `next start` is intentionally not used with static export.

The repository contains `vercel.json` plus guarded GitHub Actions deployment workflows. The standard workflow is the repository-side path; `.github/workflows/web-release-selfhosted.yml` is the zero-cost owner-only release path for environments where GitHub-hosted runner allocation is unavailable. The workflow only activates when `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` are available.

The deployment path must use Vercel's CI build output flow (`vercel pull` → `vercel build` → `vercel deploy --prebuilt`). A normal Next.js build alone is not treated as Vercel Build Output evidence.

The connected Vercel project exists. Automatic Git deployments are disabled repository-side; the intended release path is the guarded prebuilt flow described below. The reproducible lockfile gate is now verified on main/current hosted CI. Remaining Vercel verification is the project-setting/provenance reconciliation documented in `docs/VERIFICATION_BLOCKERS.md`.

## Desktop

Tauri v2 and Rust are used for the desktop runtime. The SQLite database is created inside the OS application-data directory.

Code-signing certificates and private keys are not stored in source control. They must be supplied through secure release infrastructure before signed distribution.

## Mobile

The mobile surface uses Expo Router for monitoring. Typecheck/config/build evidence is separate from Android/iOS store signing and must not be conflated.

## Local AI

The runtime is designed for local Ollama use. Cloud AI is not required by the current local-first product boundary.

## Release gate

A web deployment alone does not make desktop/mobile/product release-ready. A successful web release must come from the verified `main` commit after the rebuild has been merged and must pass `scripts/verify-live-web.mjs` against the deployed URL. Use `docs/ACCEPTANCE_MATRIX_V2.md`, `docs/RELEASE_GATES.md`, and `docs/RELEASE_READINESS.md` as the release control set.

## Monorepo build filtering

The root `vercel.json` contains an `ignoreCommand` that skips a Web deployment when the commit does not change `packages/web` or the workspace/deployment manifests. This prevents Core/Desktop-only commits from consuming Vercel build concurrency. Vercel project settings should use the repository root as the Root Directory, with Next.js as the framework preset, matching the canonical root `vercel.json`.

### Dependency resolution policy

The repository does not use an npm-install fallback for release evidence. The canonical deployment path is the committed `pnpm-lock.yaml` plus `pnpm install --frozen-lockfile`. This keeps CI and Vercel aligned and prevents a deployment from silently using dependency metadata that differs from the verified workspace state.

## Current Vercel project settings

For the connected Vercel project orbit-marketing-os, the intended production Web project should use:

- Root Directory: repository root
- Framework preset: Next.js
- Node.js: 22.x
- Build Command: `pnpm --dir packages/web build`
- Output Directory: `packages/web/out`.

The connected project's available metadata has historically reported a Vite framework. Until the project-level Root Directory/framework configuration is confirmed as repository root with Next.js, a successful production Web deployment is not considered proven.
