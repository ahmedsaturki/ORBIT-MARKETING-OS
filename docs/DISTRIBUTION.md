# ORBIT Distribution

Updated: 2026-09-29.

## Desktop

`release-desktop.yml` builds Windows, Linux, and macOS bundles when a `v*` tag is pushed, but first verifies that the tagged commit belongs to the `main` release lineage.

The current pipeline deliberately produces **unsigned** desktop artifacts. It also verifies the generated checksum manifest before publication. It generates `SHA256SUMS.txt` so users can verify downloaded files.

Signing is a separate release gate and must never use private signing keys committed to the repository.

## Mobile

The Expo project supports local development and web export. The current GitHub Actions mobile workflow produces an **unsigned Android debug validation artifact**, not a store release. Native Android/iOS distribution remains a separate gate because production signing, store accounts, and native build environments are product-release concerns.

## Web

The public web surface is live on the connected Vercel production project and responds correctly on the verified production routes.

The latest independently verified production deployment remains `dpl_3YiUkYHNpQPRaPjTZvH5UrTztEQp`, READY, Git-sourced, production-targeted, and Next.js. It belongs to the prior verified release line. Current main is not treated as a Production release because `release/PRODUCTION_RELEASE.json` remains on the bootstrap marker.

Vercel Production Provenance remains a bootstrap/non-release check while the marker is `bootstrap`; current exact-main Web Deploy run `36496595591` passed the web quality path. The next Production release must first update the reviewed non-bootstrap marker, then re-establish exact production provenance before the rollback drill.

## Release integrity

Every distributed artifact must have a release tag, a checksum entry, and documented provenance. A green build job is evidence for the artifact build only; it is not evidence of code signing, store approval, current-main provenance, or platform-policy compliance.
