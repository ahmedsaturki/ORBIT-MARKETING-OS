# ORBIT Distribution

Updated: 2026-09-28.

## Desktop

`release-desktop.yml` builds Windows, Linux, and macOS bundles when a `v*` tag is pushed, but first verifies that the tagged commit belongs to the `main` release lineage.

The current pipeline deliberately produces **unsigned** desktop artifacts. It also verifies the generated checksum manifest before publication. It generates `SHA256SUMS.txt` so users can verify downloaded files.

Signing is a separate release gate and must never use private signing keys committed to the repository.

## Mobile

The Expo project supports local development and web export. The current GitHub Actions mobile workflow produces an **unsigned Android debug validation artifact**, not a store release. Native Android/iOS distribution remains a separate gate because production signing, store accounts, and native build environments are product-release concerns.

## Web

The public web surface is live on the connected Vercel production project and responds correctly on the verified production routes.

The latest verified production deployment is `dpl_3YiUkYHNpQPRaPjTZvH5UrTztEQp`, READY, Git-sourced, targets production, uses the Next.js framework, exposes the canonical `orbit-marketing-os.vercel.app` alias, and reports exact main SHA `edc8c07f0527c7ea9b38827e293fd820b9f6cce0` through the governed provenance endpoints.

Vercel Production Provenance run `36455009698` and Web Deploy run `36455009416` passed for the latest verified release SHA. The remaining Vercel release action is the rollback drill to the previous verified candidate and back.

## Release integrity

Every distributed artifact must have a release tag, a checksum entry, and documented provenance. A green build job is evidence for the artifact build only; it is not evidence of code signing, store approval, current-main provenance, or platform-policy compliance.
