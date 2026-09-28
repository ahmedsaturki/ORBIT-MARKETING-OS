# ORBIT — Production Release Control

## Purpose

ORBIT separates ordinary development/reconciliation on `main` from an intentional Production release.

The control file is:

`release/PRODUCTION_RELEASE.json`

A production release exists only when a reviewed commit on `main` updates that marker from a non-production/bootstrap state to a unique non-bootstrap `releaseId`.

## Lifecycle

1. Build and verify normally on feature branches and `main`.
2. Do not edit the production marker for ordinary documentation, refactoring, evidence reconciliation, or unrelated product work.
3. When the product is ready for a real production release, update `release/PRODUCTION_RELEASE.json` with a unique `releaseId` in the same reviewed release commit.
4. The resolver binds the release to the Git commit that last changed the marker.
5. Vercel production deployment/provenance is allowed only for that explicit marker commit.
6. Later `main` commits may continue development without replacing the production deployment.
7. A rollback is a separate operational action tied to actual Vercel deployment IDs.

## Bootstrap

The repository starts with:

`releaseId: "bootstrap"`

The bootstrap marker is not a production release and cannot trigger a Production deployment.

## Safety rules

- Never use a source-only marker to claim Production Proven.
- Never expose credentials, tokens, cookies, signing material, or private release infrastructure.
- Never deploy an arbitrary moving `main` commit through the owner self-hosted release path.
- Never claim rollback until both rollback and return-to-current are observed.
- The release marker does not bypass the SonarCloud, connector, signing, store, billing, legal, accessibility, multi-device, or 24-hour stability gates.

## $0 / free-plan rationale

This control prevents internal release-truth and documentation commits from consuming the Production deployment path. Main CI still verifies the application on every main push; only an intentional release marker consumes the Production deployment boundary.
