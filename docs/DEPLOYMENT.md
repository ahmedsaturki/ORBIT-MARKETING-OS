# ORBIT Marketing OS — Deployment

## Web / Vercel

The web package builds a static Next.js export into packages/web/out.

The repository contains vercel.json for the monorepo build path and a guarded GitHub Actions workflow at .github/workflows/vercel-web.yml.

Before enabling production deployment:

1. Create or import the Vercel project for this repository.
2. Configure its repository root as the project root.
3. Add GitHub repository secrets: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID.
4. Push to main.

The deployment workflow intentionally does nothing until all three secrets are present.

## Desktop

Tauri v2 and Rust are used for the desktop runtime. The SQLite database is created inside the OS application-data directory.

Code-signing certificates and private keys are intentionally not stored in source control. They must be provided through a secure CI signing system when release artifacts are created.

## Mobile

The mobile surface uses Expo Router for monitoring. Android and iOS release builds need the corresponding store accounts and signing configuration.

## Local AI

The runtime uses Ollama locally. No cloud AI key is required by the current runtime.

## Release gate

A web deployment alone does not make the desktop/mobile/product commercial release-ready. Use docs/RELEASE_READINESS.md as the authoritative gate.
