# ORBIT Distribution

## Desktop

`release-desktop.yml` builds Windows, Linux, and macOS bundles when a `v*` tag is pushed, but first verifies that the tagged commit belongs to the `main` release lineage.

The current pipeline deliberately produces **unsigned** desktop artifacts. It also verifies the generated checksum manifest before publication. It also generates `SHA256SUMS.txt` so users can verify downloaded files.

Signing is a separate release gate and must never use private signing keys committed to the repository.

## Mobile

The Expo project supports local development and web export. The current GitHub Actions mobile workflow produces an **unsigned Android debug validation artifact**, not a store release. Native Android/iOS distribution remains a separate gate because production signing, store accounts, and native build environments are product-release concerns.

Free distribution currently includes source distribution plus the generated validation artifacts. Official stores may impose their own account/registration and signing requirements.

## Web

The web surface is live on the connected Vercel production project. The guarded GitHub deployment workflow remains secret-gated; its latest Web quality gate is green, while direct Vercel deployment is already READY.

## Release integrity

Every distributed artifact must have a release tag, a checksum entry, and documented provenance. A green build job is evidence for the artifact build only; it is not evidence of code signing, store approval, or platform-policy compliance.
