# ORBIT Performance Evidence

Updated: 2026-09-29.

## DATA-03 — 1,000 contacts searchable

The desktop Rust test `contact_search_1000_scale_benchmark` creates exactly 1,000 contacts in an in-memory SQLite database using the production `contacts` schema, then searches for the last contact through the same workspace-scoped display-name/email/phone matching predicate used by the desktop search path.

The test records elapsed query time and prints a machine-readable line:

`SEARCH_SCALE_BENCHMARK_JSON { ... }`

CI runs the benchmark with `--nocapture` so the measured result is visible in the workflow log.

### Exact-main evidence — DATA-03

GitHub Actions CI run `36621459773` on current main measured:

- dataset: 1,000 contacts
- query: `Benchmark Contact 0999`
- workspace scoped: true
- matched: 1
- elapsed: 1.520954 ms

The same CI run completed the benchmark successfully. This supports `VERIFIED` for DATA-03 at the automated-evidence level. It does not imply L3 production proof.

## PERF-01 / PERF-02

The repository performance harness enforces these budgets fail-closed in `scripts/startup-memory-benchmark.mjs`:

- PERF-01 startup-to-health: <= 8,000 ms
- PERF-02 peak RSS: <= 200 MB

Heap is not instrumented; no heap budget is claimed. The long-running soak test deliberately enforces a distinct 600 MB RSS ceiling (scripts/soak.ts) because it bounds process lifetime, not startup.

Exact-main CI run `36621459773` measured:

- startup-to-health: 381.11 ms
- peak RSS: 96.81 MB
- RSS samples: 14
- listener: 127.0.0.1:38563
- server announced: true
- provider: ollama-local

The core test suite exercises the bounded memory workload; heap is not instrumented and no heap budget is enforced anywhere. The startup benchmark's machine-readable output reports the measured RSS (and emits the enforced `startupBudgetMs`/`rssBudgetMb` values); it does not emit a heap figure.

These are fresh automated L2 evidence, not L3 production proof.

## Exact-main recovery evidence

Current main CI run `36621459773` produced recovery artifact `11059010547`. The artifact records 4/4 PASS across startup recovery, database recovery, recovery idempotency, and migration idempotency.

Recovery artifact: https://github.com/ahmedsaturki/ORBIT-MARKETING-OS/actions/runs/36621459773#artifacts-11059010547

## Current production provenance

The canonical Production alias currently serves deployment `dpl_9KyEbWzvAYvhvzZPmtXNJXrP16xV` on commit `9ba07318f4d580e670be9d27ec76888e66013340`. Public checks of `/`, `/api/health.json`, and `/api/release.json` passed at 2026-09-29T20:32:47Z with version `1.0.0`, matching release SHA, and `VERCEL_GIT_COMMIT_SHA` provenance. Moving `main` is a release-truth/documentation stream; its ordinary Vercel deployment is intentionally skipped/canceled and is not the serving Production SHA.

The durable machine-readable observation is `release/OBSERVED_PRODUCTION.json`, and CI now verifies that observation against the live public production alias.

## Reproducibility

Always record the exact Git SHA, workflow run, platform/runner, Node/Rust toolchain, dataset size, query, and elapsed measurement when promoting performance evidence.

## PERF-01 / PERF-02 measurement harness

The script `scripts/startup-memory-benchmark.mjs` starts the production-shaped local runtime on loopback, waits for `/api/health`, records startup-to-health time, samples process RSS during startup and a short settling window, and emits `STARTUP_MEMORY_BENCHMARK_JSON`.

The Rust test `contact_search_1000_scale_benchmark` provides the 1,000-contact DATA-03 measurement. The recovery harness `scripts/recovery-evidence.mjs` executes the four exact recovery/migration checks and writes the durable artifact.

The harnesses are intentionally tied to exact GitHub Actions runs and do not promote any gate to L3 by themselves.
