# ORBIT Distribution

## Desktop

`release-desktop.yml` builds Windows, Linux, and macOS bundles when a `v*` tag is pushed, but first verifies that the tagged commit belongs to the `main` release lineage.

The current pipeline deliberately produces **unsigned** desktop artifacts. It also verifies the generated checksum manifest before publication. It generates `SHA256SUMS.txt` so users can verify downloaded files.

Signing is a separate release gate and must never use private signing keys committed to the repository.

## Mobile

The Expo project supports local development and web export. The current GitHub Actions mobile workflow produces an **unsigned Android debug validation artifact**, not a store release. Native Android/iOS distribution remains a separate gate because production signing, store accounts, and native build environments are product-release concerns.

## Web

The public web surface is live on the connected Vercel production project and responds correctly on the verified production routes.

The latest verified production deployment is Git-sourced, uses the Next.js framework, targets production, and exposes current release provenance through the governed verification path. The immediately following docs-only main revision was attempted by Vercel but was stopped by the Ignore Build Step; the release-ignore hardening in this branch makes repository-root release-truth detection independent of Vercel Root Directory.

The canonical `orbit-marketing-os.vercel.app` alias remains on the last verified production deployment until a subsequent current-main deployment completes successfully. This is intentional: a known-good deployment is preferable to claiming provenance for an unverified revision.

## Release integrity

Every distributed artifact must have a release tag, a checksum entry, and documented provenance. A green build job is evidence for the artifact build only; it is not evidence of code signing, store approval, current-main provenance, or platform-policy compliance.
