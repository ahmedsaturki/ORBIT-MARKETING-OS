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

The canonical Production alias currently serves deployment `dpl_9KyEbWzvAYvhvzZPmtXNJXrP16xV`, READY, Git-sourced, production-targeted, and Next.js, on release SHA `9ba07318f4d580e670be9d27ec76888e66013340`. This serving state is recorded separately from moving `main`; the release marker remains the explicit Production control plane.

Vercel Production Provenance run `36609486608` completed successfully in bootstrap/non-release mode and Web Deploy run `36609486630` passed its web quality path. The current Production alias is already serving the observed v1.0.0 release baseline above; the current main documentation commit is not counted as a new serving deployment. The rollback drill remains open.

## Release integrity

Every distributed artifact must have a release tag, a checksum entry, and documented provenance. A green build job is evidence for the artifact build only; it is not evidence of code signing, store approval, current-main provenance, or platform-policy compliance.
