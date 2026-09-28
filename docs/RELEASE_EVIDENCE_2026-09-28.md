# ORBIT Release Evidence — 2026-09-28

## Exact release reference

- Main SHA: `6e1c744b78402bdfb0e1a3312f90aa2e98cc9710`
- CI run: `36364156402`
- Vercel Production Provenance run: `36364156344`
- Web Deploy run: `36364156390`
- Release Evidence Bundle run: `36364156410`
- Release Evidence Bundle artifact: `orbit-release-evidence-36364156410`
- Artifact SHA-256: `25b3161686310cd9cd91a8904a2775ed8f46f341bfdebbb670be5d4a8be97808`

## Automated verification

- Main CI: SUCCESS.
- Main security scan: SUCCESS.
- Rust quality: SUCCESS.
- Vercel production provenance: SUCCESS.
- Web Deploy: SUCCESS.
- Release Evidence Bundle: SUCCESS.

## Fresh performance measurements

### DATA-03

The exact-main Rust benchmark created and searched a 1,000-contact workspace-scoped dataset.

`SEARCH_SCALE_BENCHMARK_JSON`

```json
{"dataset":"1000 contacts","elapsed_ms":1.316917,"limit":50,"matched":1,"query":"Benchmark Contact 0999","workspace_scoped":true}
```

Disposition: automated evidence is VERIFIED. No numeric DATA-03 latency threshold is published by the current acceptance contract.

### PERF-01

The exact-main startup harness launched the production-shaped local runtime on loopback and waited for a successful health response.

`STARTUP_MEMORY_BENCHMARK_JSON`

```json
{"dataset":"local runtime startup","startup_ms":376.05,"peak_rss_mb":100.44,"rss_samples":14,"host":"127.0.0.1","port":40581,"server_announced":true,"provider":"ollama-local"}
```

Disposition: measurement captured. Budget compliance remains PARTIAL because the current acceptance contract does not publish a numeric PERF-01 budget.

### PERF-02

The same exact-main run measured process RSS during startup and the settling window.

Peak RSS: `100.44MB`.

Disposition: measurement captured. Budget compliance remains PARTIAL because the current acceptance contract does not publish a numeric PERF-02 budget.

## Release-truth boundary

This evidence does not promote any release-critical gate to L3 production proof. The external/owner-controlled gates remain governed by `release/readiness.json`, including real Telegram/LinkedIn authorization, live multi-device network evidence, 24-hour soak, rollback drill, signing/store distribution, billing, legal/commercial review, and current SonarCloud A quality requirement.
