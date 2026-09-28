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
- Exact-main CI run `36364156402` on `6e1c744b78402bdfb0e1a3312f90aa2e98cc9710` measured `1.316917ms`, with one matching result and workspace scoping enabled.
- The measurement supports `VERIFIED` for DATA-03 at the automated-evidence level; it does not imply L3 production proof.

## PERF-01 / PERF-02

Startup and memory budget compliance remains a separate reconciliation question. The exact-main CI run `36364156402` measured startup-to-health at `376.05ms` and peak RSS at `100.44MB`. The repository currently does not publish a numeric acceptance budget for PERF-01 or PERF-02, so these gates remain `PARTIAL` rather than being promoted from measurement to budget compliance.

## Reproducibility

Always record the exact Git SHA, workflow run, platform/runner, Node/Rust toolchain, dataset size, query, and elapsed measurement when promoting performance evidence.

## PERF-01 / PERF-02 measurement harness

The script `scripts/startup-memory-benchmark.mjs` starts the production-shaped local runtime on loopback, waits for `/api/health`, records startup-to-health time, and samples process RSS during startup and a short settling window. It prints `STARTUP_MEMORY_BENCHMARK_JSON` for exact-run evidence.

The harness is intentionally measurement-only: it does not invent a pass/fail threshold where the release contract does not publish one. The current exact-main measurement is retained here as evidence; a future numeric target must be added to the acceptance contract before PERF-01/02 can be promoted beyond `PARTIAL` on the basis of budget compliance.
