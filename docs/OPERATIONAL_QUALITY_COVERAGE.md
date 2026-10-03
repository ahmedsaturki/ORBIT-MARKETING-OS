# ORBIT — Operational Quality Coverage

This track covers production operation and client compatibility in addition to security and source-level CI.

## Browser compatibility

The repository-owned Playwright suite runs unchanged against Chromium, Firefox, and WebKit in a dedicated workflow. This is intentionally separate from the default single-browser CI so broader browser coverage does not inflate every ordinary CI run.

## Production health monitoring

A scheduled GitHub Actions probe checks the public Production alias hourly. It verifies HTTP availability, key security headers, the health and release JSON contracts, PWA manifest reachability, service-worker reachability, release SHA consistency, and accepted provenance sources.

The monitor does not mutate the production deployment and uses no secret or paid monitoring service.

## Release architecture

The existing release workflow remains responsible for deterministic builds, checksum manifests, SBOM generation, and artifact provenance attestations. Production promotion remains controlled by the reviewed release marker and the existing release/provenance workflows.
