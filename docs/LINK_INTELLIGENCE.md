# ORBIT Link Intelligence

## Scope

Link Intelligence is a local-first, workspace-scoped registry for deterministic tracked links and evidence.

## Invariants

- Every link belongs to exactly one active workspace.
- Link keys are deterministic and scoped by workspace.
- Destination and tracked URLs must use HTTP or HTTPS and must not contain credentials.
- A tracked URL must preserve the destination scheme, host, port, and path.
- Evidence records require an allowed source type and bounded provenance.
- Evidence is deduplicated by workspace, link, source, metric, observation time, and source locator.
- Metrics are not treated as verified external facts unless their source/provenance says so.
- Writes are role-gated and auditable.

## Workflow

`destination → deterministic link record → campaign/content context → observed evidence → report`

## Security boundary

Link Intelligence does not read the secret vault, does not execute connectors, and does not claim click data without stored evidence.

## Product boundary

This layer is designed to support future reporting, attribution, and content learning while preserving ORBIT's local ownership and governed execution model.

## Native IPC contract

`marketing_link_evidence_add` receives its evidence payload under the command's `input` property. Native E2E coverage verifies persistence, deduplication, and workspace isolation against this contract.
