# ORBIT — Final External Actions

Updated: 2026-09-25

The core implementation and main CI baseline are verified, and a READY Vercel production deployment exists. The remaining actions below require credentials, a real platform account, a native/physical environment, or a human-controlled release decision.

## A. Enable zero-cost technical verification

1. A committed `pnpm-lock.yaml` and desktop `Cargo.lock` are already present on `main` and frozen install has passed in hosted CI.
2. A self-hosted runner is only needed for the remaining native/manual gates. When used, register an owned Linux/WSL runner with the labels required by the current workflow.
3. Run **Self-Hosted Verification** against the current target branch only when native/runtime acceptance requires it.
4. Preserve the resulting artifacts/logs with exact commit identity; do not convert source presence into verification claims.

## B. Web deployment

The repository now uses a reproducible web deployment contract:

- Next.js static export.
- Frozen pnpm install.
- `packages/web/out` output.
- Missing lockfile fails closed.

Before declaring Vercel provenance fully reconciled, verify the Vercel project settings manually:

- Root Directory: repository root (the single deployment source is the root `vercel.json`).
- Framework: Next.js.
- Production build must use the committed lockfile.
- Output directory: `packages/web/out`.
- Build command: `pnpm --dir packages/web build`.

Do not treat an older Vercel ERROR caused by dependency metadata fetching as proof that the current source build fails.

## C. Desktop/mobile distribution

Desktop release remains gated on:

- clean quality verification;
- Tauri bundle build;
- platform-specific artifact generation;
- signing/notarization when credentials become available.

Mobile release remains a validation artifact until Android/iOS signing and store distribution are independently configured.

## D. Commercial release

Before selling the product as a production release, collect current evidence for:

- security audit;
- backup/restore drill;
- connector authorization tests;
- challenge/manual-intervention behavior;
- performance measurements;
- browser E2E;
- crash/restart recovery;
- signed artifacts and checksums;
- terms/privacy/refund pages;
- actual payment/checkout configuration.
