# ORBIT — Quality and Release Actions

ORBIT already has repository-owned CI for unit/integration tests, runtime smoke, browser E2E, accessibility/RTL checks, performance smoke, native desktop/mobile validation, release readiness, and production provenance. This document records the additional independent layers added to cover important quality dimensions without replacing those existing contracts.

## Code quality and SAST

**CodeQL** analyzes both JavaScript/TypeScript and Rust using the \`security-and-quality\` query suite. Rust uses CodeQL's no-build mode, which is supported for Rust. Results are uploaded to GitHub Code Scanning.

## Rust dependency quality

**cargo-deny** checks the desktop Cargo dependency graph for banned/duplicate dependency patterns, license policy, and untrusted registry/git sources using the committed \`deny.toml\`.

## Documentation quality

**Lychee** checks Markdown, HTML, and reStructuredText links on documentation changes and on a weekly schedule. The workflow fails when an actual broken link is detected.

## Web quality

**Lighthouse CI** audits the real static export in \`packages/web/out\`. It checks performance, accessibility, best-practices, and SEO budgets. Reports are retained as GitHub workflow artifacts.

## Release transparency

Desktop releases now generate an SPDX JSON SBOM from the tagged source tree and create GitHub artifact attestations covering the release checksum manifest. This provides a machine-verifiable link between release files, their hashes, the workflow, and the exact source commit.

All third-party actions are pinned to immutable commit SHAs. Existing release gates remain authoritative; these layers add independent evidence and do not silently downgrade or replace existing checks.
