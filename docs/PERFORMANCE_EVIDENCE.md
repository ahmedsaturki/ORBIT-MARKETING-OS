# ORBIT Performance Evidence

Updated: 2026-09-28.

## DATA-03 — 1,000 contacts searchable

The desktop Rust test `contact_search_1000_scale_benchmark` creates exactly 1,000 contacts in an in-memory SQLite database using the production `contacts` schema, then searches for the last contact through the same workspace-scoped display-name/email/phone matching predicate used by the desktop search path.

The test records elapsed query time and prints a machine-readable line:

`SEARCH_SCALE_BENCHMARK_JSON { ... }`

CI runs the benchmark with `--nocapture` so the measured result is visible in the workflow log.

### Exact-main evidence — DATA-03

GitHub Actions CI run `36455009654` on exact main SHA `edc8c07f0527c7ea9b38827e293fd820b9f6cce0` measured:

- dataset: 1,000 contacts
- query: `Benchmark Contact 0999`
- workspace scoped: true
- matched: 1
- elapsed: 1.50868 ms

The same CI run completed the benchmark successfully. This supports `VERIFIED` for DATA-03 at the automated-evidence level. It does not imply L3 production proof.

## PERF-01 / PERF-02

The repository performance harness enforces these budgets:

- PERF-01 startup-to-health: <= 8,000 ms
- PERF-02 peak RSS: <= 200 MB
- PERF-02 heap used: <= 100 MB in the core performance workload test

Exact-main CI run `36455009654` on `edc8c07f0527c7ea9b38827e293fd820b9f6cce0` measured:

- startup-to-health: 387.4 ms
- peak RSS: 100.15 MB
- RSS samples: 14
- listener: 127.0.0.1:37387
- server announced: true
- provider: ollama-local

The core test suite also exercises the bounded memory workload and enforces the RSS/heap budgets before accepting its result. The startup benchmark's machine-readable output reports the measured RSS above; it does not emit a separate heap figure.

These are fresh automated L2 evidence, not L3 production proof.

## Exact-main recovery evidence

The same exact-main CI run produced recovery artifact `10985138175` for SHA `edc8c07f0527c7ea9b38827e293fd820b9f6cce0`. The artifact records 4/4 PASS across startup recovery, database recovery, recovery idempotency, and migration idempotency.

Recovery artifact: https://github.com/ahmedsaturki/ORBIT-MARKETING-OS/actions/runs/36455009654#artifacts-10985138175

## Current production provenance

The current production deployment `dpl_3YiUkYHNpQPRaPjTZvH5UrTztEQp` is READY, Git-sourced, production-targeted, and reports the exact main SHA `edc8c07f0527c7ea9b38827e293fd820b9f6cce0`. Vercel Production Provenance run `36455009698` and Web Deploy run `36455009416` both passed.

The live verification checked `/`, `/api/health.json`, and `/api/release.json` against `edc8c07f0527c7ea9b38827e293fd820b9f6cce0`.

Deployment details: https://vercel.com/jmls-projects/orbit-marketing-os/4agH7CGGXx6z6dMtN9nG86HpMHc2

## Reproducibility

Always record the exact Git SHA, workflow run, platform/runner, Node/Rust toolchain, dataset size, query, and elapsed measurement when promoting performance evidence.

## PERF-01 / PERF-02 measurement harness

The script `scripts/startup-memory-benchmark.mjs` starts the production-shaped local runtime on loopback, waits for `/api/health`, records startup-to-health time, samples process RSS during startup and a short settling window, and emits `STARTUP_MEMORY_BENCHMARK_JSON`.

The Rust test `contact_search_1000_scale_benchmark` provides the 1,000-contact DATA-03 measurement. The recovery harness `scripts/recovery-evidence.mjs` executes the four exact recovery/migration checks and writes the durable artifact.

The harnesses are intentionally tied to exact GitHub Actions runs and do not promote any gate to L3 by themselves.
