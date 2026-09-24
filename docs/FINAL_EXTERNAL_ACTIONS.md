# ORBIT — Final External Actions

Updated: 2026-09-24

The codebase is intentionally not marked production-ready yet. The remaining actions below require access to the user's GitHub/Vercel account or execution environment.

## A. Enable zero-cost technical verification

1. Open the repository **Settings → Actions → Runners → New self-hosted runner**.
2. Register the user's owned Windows/Linux/macOS machine.
3. Ensure the runner has custom labels:
   - `orbit`
   - `x64`
4. Confirm the runner is **Idle/Online**.
5. Run **Actions → Bootstrap Lockfile → Run workflow** on `rebuild/orbit-production`.
6. Verify that `pnpm-lock.yaml` was committed to the branch.
7. Run **Actions → Self-Hosted Verification → Run workflow**.
8. Do not promote or merge unless the verification job is green and the release matrix has current evidence.

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

