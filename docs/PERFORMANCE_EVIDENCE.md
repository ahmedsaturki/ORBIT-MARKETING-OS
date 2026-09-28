# ORBIT Performance Evidence

Updated: 2026-09-28.

## DATA-03 — 1,000 contacts searchable

The desktop Rust test `contact_search_1000_scale_benchmark` creates exactly 1,000 contacts in an in-memory SQLite database using the production `contacts` schema, then searches for the last contact through the same workspace-scoped display-name/email/phone matching predicate used by the desktop search path.

The test records elapsed query time and prints a machine-readable line:

`SEARCH_SCALE_BENCHMARK_JSON { ... }`

CI runs the benchmark with `--nocapture` so the measured result is visible in the workflow log.

### Interpretation

- PASS means the 1,000-contact fixture is searchable through the tested predicate and the benchmark produced a timing measurement.
- This benchmark does not invent a latency target. The acceptance matrix requires a performance benchmark but does not define a numeric DATA-03 latency threshold.
- Do not promote DATA-03 beyond the repository's documented readiness level solely from the existence of this test. A release evidence reconciliation must reference the actual CI run and reviewed measurement.

## PERF-01 / PERF-02

Startup and memory targets remain separate gates. The existing soak harness measures RSS against its own 600 MB operational budget, while PERF-01/02 require measured benchmarks against their documented release targets. Until those targets and fresh measurements are reconciled in release evidence, these gates remain open.

## Reproducibility

Always record the exact Git SHA, workflow run, platform/runner, Node/Rust toolchain, dataset size, query, and elapsed measurement when promoting performance evidence.

## PERF-01 / PERF-02 measurement harness

The script `scripts/startup-memory-benchmark.mjs` starts the production-shaped local runtime on loopback, waits for `/api/health`, records startup-to-health time, and samples process RSS during startup and a short settling window. It prints `STARTUP_MEMORY_BENCHMARK_JSON` for exact-run evidence.

The harness is intentionally measurement-only: it does not invent a pass/fail threshold where the release contract does not publish one. A release reconciliation must compare the recorded values with the accepted target before promoting PERF-01 or PERF-02.

