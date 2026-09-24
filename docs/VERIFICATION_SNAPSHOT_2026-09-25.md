# ORBIT Verification Snapshot — 2026-09-25

## Source
- Branch: `rebuild/orbit-production`
- Current source line is tracked by PR #2 (open, draft, unmerged).

## Source hardening completed in the current tranche
- Rust compile blockers fixed: duplicate derive attributes, malformed rule-test string, missing audit test workspace fixture.
- Account upsert now persists and reports the authorization/session state actually stored for the workspace account.
- Task scheduling timestamps are normalized to UTC RFC3339.
- Native task retry counts are bounded to 1..=10, and connector rule-pack retry limits cannot exceed task limits.
- Approval request/decision actors are bound to the local runtime identity instead of trusting arbitrary UI-provided actor IDs.
- LinkedIn connector default API version is `202609`.
- Workspace sanity verification checks for duplicate consecutive Rust derive attributes.
- LAN runtime rate limiting now runs before bearer-token validation, with explicit invalid-token brute-force smoke coverage.

## Execution truth
The latest rebuild CI attempts still fail before the first workflow step starts. GitHub records the job with no runner allocation (`runner_id=0`), empty runner name, and no steps. Consequently, no clean TypeScript, Rust, browser, or build PASS is claimed from those runs.

## Reproducible lockfiles
- `pnpm-lock.yaml`: not yet committed.
- `packages/desktop/src-tauri/Cargo.lock`: not yet committed.

The repository intentionally does not fabricate either lockfile. The bootstrap workflow generates both on a real owned runner and commits them to the rebuild branch.

## Release/deployment state
- The rebuild branch uses a guarded Next.js static export at `packages/web/out`.
- Vercel automatic Git deployment is disabled; the guarded prebuilt workflow is the intended production path.
- A successful rebuild production deployment remains unverified.
- Desktop release artifacts are validation/unsigned until signing is configured.
- Mobile release is validation-only until production signing/distribution is configured.
- Commercial checkout/payment configuration remains unverified.

## Current external compatibility
- Next.js 16.3.6 is the current Active LTS patch from the September 22, 2026 security update; the scheduled September 30, 2026 release is expected to supersede it. https://nextjs.org/blog
- Expo SDK 57 is the current stable SDK 57 line; Expo 57.0.24 is the package version used by ORBIT, with React Native 0.86 compatibility. https://expo.dev/changelog/sdk-57
- LinkedIn Marketing API version 202609 is active for September 2026. https://learn.microsoft.com/en-us/linkedin/marketing/integrations/migrations?view=li-lms-2026-09
- Vercel CLI 59.23.1 is the currently published CLI pinned by the repository's release workflows. https://www.npmjs.com/package/vercel

## Release consequence
The implementation continues, but production launch remains gated on actual runner execution, reproducible lockfiles, clean verification, live deployment verification, signing/distribution, real connector evidence, and commercial prerequisites.
