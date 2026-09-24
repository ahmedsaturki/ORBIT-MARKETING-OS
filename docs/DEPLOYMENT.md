# ORBIT Marketing OS — Deployment

## Web / Vercel

The web package is a static Next.js export into `packages/web/out`.

The repository contains `vercel.json` plus a guarded GitHub Actions deployment workflow. The workflow only activates when `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` are available.

The deployment path must use Vercel's CI build output flow (`vercel pull` → `vercel build` → `vercel deploy --prebuilt`). A normal Next.js build alone is not treated as Vercel Build Output evidence.

The Vercel project exists and receives Git deployments from `rebuild/orbit-production`. Release verification is still blocked by the dependency metadata fetch failure documented in `docs/VERIFICATION_BLOCKERS.md`.

## Desktop

Tauri v2 and Rust are used for the desktop runtime. The SQLite database is created inside the OS application-data directory.

Code-signing certificates and private keys are not stored in source control. They must be supplied through secure release infrastructure before signed distribution.

## Mobile

The mobile surface uses Expo Router for monitoring. Typecheck/config/build evidence is separate from Android/iOS store signing and must not be conflated.

## Local AI

The runtime is designed for local Ollama use. Cloud AI is not required by the current local-first product boundary.

## Release gate

A web deployment alone does not make desktop/mobile/product release-ready. Use `docs/ACCEPTANCE_MATRIX_V2.md`, `docs/RELEASE_GATES.md`, and `docs/RELEASE_READINESS.md` as the release control set.

## Monorepo build filtering

The root `vercel.json` contains an `ignoreCommand` that skips a Web deployment when the commit does not change `packages/web` or the workspace/deployment manifests. This prevents Core/Desktop-only commits from consuming Vercel build concurrency. Vercel project settings should still use `packages/web` as the Root Directory for the dedicated Web project, with Next.js as the framework preset.

### Dependency-fetch fallback

The connected deployment environment previously failed during pnpm metadata resolution. The Web deployment now uses an isolated npm install for `packages/web` with workspaces disabled, followed by the Web build. This is a deployment workaround only; the repository CI remains pnpm-based and still requires a real lockfile for reproducible release evidence.
