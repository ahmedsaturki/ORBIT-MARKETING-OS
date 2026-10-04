# ORBIT Release Gate Tracking

Automated tracking of the 13 release-critical gates that gate a production release.

**Current status: 0/13 gates at `L3_PRODUCTION_PROVEN`.** Run `pnpm gate:check` for the
live numbers — the table below is a snapshot, not the source of truth.

The authoritative record is [`release/readiness.json`](../release/readiness.json).
Nothing in this document or in the tooling may restate a gate level independently;
every tool derives from that file.

## Commands

```bash
pnpm gate:check                              # human-readable gate report
pnpm gate:check --json                       # machine-readable
pnpm gate:check --commercial                   # exit non-zero unless all gates are L3
pnpm gate:export --format csv|json|markdown
pnpm gate:export --format json --output gate-status.json
```

`gate:check` exits `1` whenever any gate is below L3, so it can gate a pipeline directly.
`--commercial` applies the stricter commercial bar and fails with a distinct message.

All three tools accept `ORBIT_READINESS_FILE=<path>` to operate on a readiness
document other than the default, which is how the test suite exercises the
production-proven path without editing the real file.

## How status is determined

A gate is **blocked if and only if its level is not `L3_PRODUCTION_PROVEN`.**

This is deliberately not "the gate has notes explaining what is outstanding". Every
gate carries notes whether or not it is blocked, so a notes-based rule reports
13/13 blocked forever and can never report a release as ready.

`scripts/release-gate-model.mjs` is the single implementation of this rule. The
dashboard, the checker, and the exporter all import it, and
`scripts/release-gate-model.test.mjs` asserts it agrees with
`scripts/verify-release-readiness.mjs` — the existing authority for readiness
semantics — on the current document and on fully-proven fixtures.

Gates listed in `release/readiness.json` but absent from the tracked set, and gates
expected but missing from the document, are both surfaced rather than dropped.

## Levels

| Level                  | Meaning                                        |
| ---------------------- | ---------------------------------------------- |
| `L0_DESIGNED`          | Designed, not implemented                      |
| `L1_IMPLEMENTED`       | Implemented, not verified                      |
| `L2_VERIFIED`          | Verified, not yet proven in production         |
| `L3_PRODUCTION_PROVEN` | Proven in production — the release requirement |

Production readiness requires **every** release-critical gate at `L3_PRODUCTION_PROVEN`.
L3 additionally requires `evidenceRefs` and `verifiedAt`, which
`verify-release-readiness.mjs` enforces.

## Gates

Owner and priority are static metadata defined in the gate model. Level and blocker
come from `release/readiness.json`.

| Key                   | Gate                | Owner       | Priority | Level | Blocker                                                         |
| --------------------- | ------------------- | ----------- | -------- | ----- | --------------------------------------------------------------- |
| `source_integrity`    | Source Integrity    | Engineering | high     | L2    | SonarCloud is B on New Code, A required                         |
| `build`               | Build               | Engineering | high     | L2    | Desktop/mobile signing and store distribution not configured    |
| `runtime`             | Runtime             | Engineering | high     | L2    | Forced-crash recovery and 24h stability open                    |
| `product_workflows`   | Product Workflows   | Engineering | medium   | L2    | Real external connector workflows separate                      |
| `security_governance` | Security Governance | Engineering | medium   | L2    | Final L3 commercial governance needs auditable evidence         |
| `distribution`        | Distribution        | Engineering | high     | L2    | Desktop signing/notarization and mobile store distribution open |
| `web_production`      | Web Production      | Engineering | medium   | L2    | Rollback and remaining gates open                               |
| `external_connectors` | External Connectors | Commercial  | high     | L1    | Real Telegram/LinkedIn authorization evidence required          |
| `sync_network`        | Sync Network        | Engineering | medium   | L2    | Live multi-device CRDT operation unproven                       |
| `accessibility`       | Accessibility       | Engineering | medium   | L2    | Manual WCAG/RTL audit open                                      |
| `stability_soak`      | Stability Soak      | Engineering | high     | L2    | 24h soak on the exact release SHA not completed                 |
| `commercial_billing`  | Commercial Billing  | Commercial  | low      | L1    | Payment/billing provider not activated                          |
| `legal_commercial`    | Legal/Commercial    | Commercial  | low      | L1    | Legal/commercial publication review pending                     |

Counts at the time of writing: 3 at L1, 10 at L2, 0 at L3, 13 blocked;
10 engineering-owned, 3 commercial-owned; 6 high, 5 medium, 2 low priority.

## Files

| File                                    | Role                                       |
| --------------------------------------- | ------------------------------------------ |
| `release/readiness.json`                | Authoritative gate levels and evidence     |
| `scripts/release-gate-model.mjs`        | Single definition of gate status semantics |
| `scripts/check-release-gates.mjs`       | CLI report, `--json`, `--commercial`       |
| `scripts/export-gate-status.mjs`        | JSON / CSV / Markdown export               |
| `scripts/gate-dashboard.mjs`            | Serves the dashboard and its data          |
| `scripts/gate-status-dashboard.html`    | Dashboard UI                               |
| `scripts/release-gate-model.test.mjs`   | Model semantics and authority agreement    |
| `scripts/release-gate-tooling.test.mjs` | CLI, export, and dashboard-wiring contract |
| `scripts/verify-release-readiness.mjs`  | Pre-existing readiness authority           |

## Dashboard

`pnpm gate:dashboard` serves the dashboard, `release/readiness.json`, and the shared
gate model from one origin, so no external static server or network install is needed.
It binds to `127.0.0.1` only and rejects paths that resolve outside the repository.

Useful flags:

```bash
pnpm gate:dashboard --port 9000
pnpm gate:dashboard --readiness path/to/readiness.json   # preview another document
```

The dashboard refreshes every 5 minutes, reports unaccounted-for gates explicitly,
and shows a load failure rather than an empty page when its data is unavailable.

## Tests

```bash
pnpm test:release-gate-model
pnpm test:release-gate-tooling
```

Both are plain Node scripts, following the existing convention of assertions in a
`.test.mjs` file rather than a test framework.
