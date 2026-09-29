# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-09-29

Production release of ORBIT Marketing OS. The codebase has transitioned from the 0.x pre-release line to the first stable 1.0.0 milestone. The production release marker (`release/PRODUCTION_RELEASE.json`) declares `v1.0.0`, with release-critical gates remaining open pending verification.

### Added

- Production release marker `release/PRODUCTION_RELEASE.json` declaring `mode: EXPLICIT_PRODUCTION_RELEASE`, `version: 1.0.0`, and `status: PRODUCTION_READY`.
- Health endpoints `/api/health` and `/api/health.json` emitting the declared release version and provenance (`declared` mode) for runtime availability and provenance checks.
- Release info endpoint `/api/release` and `/api/release.json` exposing the declared production version, release SHA, and provenance source for external verification.

### Changed

- Bumped `packages/web/package.json` version from `0.2.0` to `1.0.0` to reflect the stable production release and the major SemVer boundary.

### Fixed

- Health endpoint response: version and provenance fields now consistently report the declared release version and provenance state, resolving a discrepancy where stale/default values were surfaced instead of the production marker.
