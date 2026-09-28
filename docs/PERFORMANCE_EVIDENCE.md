# ORBIT Performance Evidence

Updated: 2026-09-28.

## DATA-03 — 1,000 contacts searchable

The desktop Rust test `contact_search_1000_scale_benchmark` creates exactly 1,000 contacts in an in-memory SQLite database using the production `contacts` schema, then searches for the last contact through the same workspace-scoped display-name/email/phone matching predicate used by the desktop search path.

The test records elapsed query time and prints a machine-readable line:

`SEARCH_SCALE_BENCHMARK_JSON { ... }`

CI runs the benchmark with `--nocapture` so the measured result is visible in the workflow log.

### Exact-main evidence — DATA-03

GitHub Actions CI run `36425376303` on exact main SHA `367c0de11cd7c075ff59448cb7dafdfaf98faffa` measured:

- dataset: 1,000 contacts
- query: `Benchmark Contact 0999`
- workspace scoped: true
- matched: 1
- elapsed: 1.501363 ms

This supports `VERIFIED` for DATA-03 at the automated-evidence level. It does not imply L3 production proof.

## PERF-01 / PERF-02

The benchmark harness explicitly enforces these budgets:

- PERF-01 startup-to-health: <= 8,000 ms
- PERF-02 peak RSS: <= 200 MB
- PERF-02 heap used: <= 100 MB

Exact-main CI run `36425376303` on `367c0de11cd7c075ff59448cb7dafdfaf98faffa` measured:

- startup-to-health: 384.63 ms
- peak RSS: 104.4 MB
- RSS samples: 14
- listener: 127.0.0.1:34029
- server announced: true
- provider: ollama-local

The companion memory workload completed its assertions for 1,000 contacts, 500 queue tasks, 500 inbox messages, 200 media assets, and 100 generated variants before the memory result was accepted. The benchmark passes the configured RSS and heap budgets in this exact run.

These are fresh automated L2 evidence, not L3 production proof.

## Exact-main recovery evidence

The same exact-main CI run produced recovery artifact `10971258468` for SHA `367c0de11cd7c075ff59448cb7dafdfaf98faffa`. It records 4/4 PASS across startup recovery, database recovery, recovery idempotency, and migration idempotency.

## Reproducibility

Always record the exact Git SHA, workflow run, platform/runner, Node/Rust toolchain, dataset size, query, and elapsed measurement when promoting performance evidence.

## PERF-01 / PERF-02 measurement harness

The script `scripts/startup-memory-benchmark.mjs` starts the production-shaped local runtime on loopback, waits for `/api/health`, records startup-to-health time, samples process RSS during startup and a short settling window, and emits `STARTUP_MEMORY_BENCHMARK_JSON`.

The Rust test `contact_search_1000_scale_benchmark` provides the 1,000-contact DATA-03 measurement. The recovery harness `scripts/recovery-evidence.mjs` executes the four exact recovery/migration checks and writes the durable artifact.

The harnesses are intentionally tied to exact GitHub Actions runs and do not promote any gate to L3 by themselves.
