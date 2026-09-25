# ORBIT — Final External Actions

Updated: 2026-09-24

The codebase is intentionally not marked production-ready yet. The remaining actions below require access to the user's GitHub/Vercel account or execution environment.

## A. Enable zero-cost technical verification
The repository also contains `.github/workflows/bootstrap-lockfiles-hosted.yml`, owner-restricted to the consolidated branch, for generating the reproducible lockfiles on a GitHub-hosted Linux runner when self-hosted execution is unavailable.


1. Open the repository **Settings → Actions → Runners → New self-hosted runner**.
2. Register the user's owned Linux machine or Ubuntu-on-WSL environment.
3. Ensure the runner is `Online/Idle` and advertises the exact `self-hosted` + `x64` + `linux` labels used by the workflows. No custom `orbit` label is required.
4. Confirm the runner is **Idle/Online**.
5. From **Actions → Bootstrap pnpm lockfile → Run workflow**, select `rebuild/orbit-production-consolidated`.
6. Verify that both `pnpm-lock.yaml` and `packages/desktop/src-tauri/Cargo.lock` were committed to the selected branch.
7. From **Actions → Self-Hosted Verification → Run workflow**, select `rebuild/orbit-production-consolidated`.
8. Do not promote or merge unless the verification job is green and the release matrix has current evidence.
9. After the consolidation PR is merged to `main`, use **Web Release — Self-Hosted** for the guarded production web deployment, then require `scripts/verify-live-web.mjs` to pass.

## B. Web deployment

The repository now uses a reproducible web deployment contract:

- Next.js static export.
- Frozen pnpm install.
- `packages/web/out` output.
- Missing lockfile fails closed.

Before final production deployment, verify the Vercel project settings manually:

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

