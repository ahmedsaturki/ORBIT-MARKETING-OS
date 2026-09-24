# ORBIT Marketing OS — Deployment

## Web / Vercel

The web package is a static Next.js export into `packages/web/out`.

The repository contains `vercel.json` plus a guarded GitHub Actions deployment workflow. The workflow only activates when `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` are available.

The deployment path must use Vercel's CI build output flow (`vercel pull` → `vercel build` → `vercel deploy --prebuilt`). A normal Next.js build alone is not treated as Vercel Build Output evidence.

An actual Vercel project and deployment are still unverified for ORBIT.

## Desktop

Tauri v2 and Rust are used for the desktop runtime. The SQLite database is created inside the OS application-data directory.

Code-signing certificates and private keys are not stored in source control. They must be supplied through secure release infrastructure before signed distribution.

## Mobile

The mobile surface uses Expo Router for monitoring. Typecheck/config/build evidence is separate from Android/iOS store signing and must not be conflated.

## Local AI

The runtime is designed for local Ollama use. Cloud AI is not required by the current local-first product boundary.

## Release gate

A web deployment alone does not make desktop/mobile/product release-ready. Use `docs/ACCEPTANCE_MATRIX_V2.md`, `docs/RELEASE_GATES.md`, and `docs/RELEASE_READINESS.md` as the release control set.
