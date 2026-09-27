# ORBIT Marketing OS — Deployment

## Web / Vercel

The web package is a static Next.js export into `packages/web/out`. For a local smoke preview, serve that directory with any static HTTP server (for example Python's built-in `http.server`); `next start` is intentionally not used with static export.

The repository contains `vercel.json` plus guarded GitHub Actions deployment workflows. The standard workflow is the repository-side path; `.github/workflows/web-release-selfhosted.yml` is the zero-cost owner-only release path for environments where GitHub-hosted runner allocation is unavailable. The workflow only activates when `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` are available.

The deployment path must use Vercel's CI build output flow (`vercel pull` → `vercel build` → `vercel deploy --prebuilt`). A normal Next.js build alone is not treated as Vercel Build Output evidence.

The connected Vercel project exists with governed Git deployment enabled for `main` and disabled for other branches. The standard release path is now the repository's governed Git deployment plus exact-SHA live verification; a credential-backed prebuilt path remains available when explicitly authorized. The reproducible lockfile gate is verified in hosted CI.

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

The root `vercel.json` contains an `ignoreCommand` that skips unrelated Core/Desktop/docs-only changes while forcing a Web deployment for Web code/config, release metadata, provenance scripts, lockfiles, and the release-truth documents. This preserves build capacity without allowing release-evidence changes to leave the public deployment on an older SHA.

### Dependency resolution policy

The repository does not use an npm-install fallback for release evidence. The canonical deployment path is the committed `pnpm-lock.yaml` plus `pnpm install --frozen-lockfile`. This keeps CI and Vercel aligned and prevents a deployment from silently using dependency metadata that differs from the verified workspace state.

## Current Vercel project settings

For the connected Vercel project orbit-marketing-os, the intended production Web project should use:

- Root Directory: repository root
- Framework preset: Next.js
- Node.js: 22.x
- Build Command: `pnpm --dir packages/web build`
- Output Directory: `packages/web/out`.

The current connected production deployment metadata reports the Next.js framework and repository Git source. Production proof still requires the canonical public alias to expose the exact current `main` SHA after each release-truth change.
