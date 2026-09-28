# ORBIT Performance Evidence

Updated: 2026-09-28.

## DATA-03 — 1,000 contacts searchable

The desktop Rust test `contact_search_1000_scale_benchmark` creates exactly 1,000 contacts in an in-memory SQLite database using the production `contacts` schema, then searches for the last contact through the same workspace-scoped display-name/email/phone matching predicate used by the desktop search path.

The test records elapsed query time and prints a machine-readable line:

`SEARCH_SCALE_BENCHMARK_JSON { ... }`

CI runs the benchmark with `--nocapture` so the measured result is visible in the workflow log.

### Exact-main evidence

GitHub Actions CI run `36364156402` on exact main SHA `6e1c744b78402bdfb0e1a3312f90aa2e98cc9710` measured:

- dataset: 1,000 contacts
- query: `Benchmark Contact 0999`
- workspace scoped: true
- matched: 1
- elapsed: 1.316917 ms

This supports `VERIFIED` for DATA-03 at the automated-evidence level. It does not imply L3 production proof.

## PERF-01 — Startup budget

The production-shaped local runtime benchmark starts `server.ts` with `NODE_ENV=production`, uses an isolated loopback port, waits for the announced listener and `/api/health`, and fails above the explicit 8,000 ms startup budget.

Exact-main CI run `36364156402` on `6e1c744b78402bdfb0e1a3312f90aa2e98cc9710` measured:

- startup-to-health: 376.05 ms
- budget: 8,000 ms
- listener: 127.0.0.1:40581
- server announced: true
- provider: ollama-local

Result: the exact-run benchmark passed the implemented PERF-01 budget.

## PERF-02 — Memory budget

The companion workload benchmark exercises 1,000 contacts, 500 queue tasks, 500 inbox messages, 200 media assets, and 100 generated variants before trusting the memory measurement. The explicit budgets are 200 MB RSS and 100 MB heap used.

The same exact-main CI run `36364156402` measured:

- peak RSS: 100.44 MB
- RSS budget: 200 MB
- heap budget: 100 MB
- samples: 14
- workload: 1,000 contacts / 500 tasks / 500 messages / 200 media / 100 variants

Result: the exact-run benchmark passed the implemented PERF-02 RSS budget. The reported benchmark process also completed the workload-count assertions before the memory value was accepted.

## Interpretation and evidence level

These measurements are fresh automated evidence for the exact main SHA and therefore support `VERIFIED`/L2 treatment of the corresponding performance gates. They do not establish L3 production proof, field stability, or commercial readiness.

## Reproducibility

Always retain the exact Git SHA, workflow run, platform/runner, Node/Rust toolchain, dataset size, workload counts, query, and measured outputs when reconciling performance evidence.

## Harness

The primary measurement script is `scripts/startup-memory-benchmark.mjs`; the 1,000-contact search benchmark is the Rust test `contact_search_1000_scale_benchmark`. Both emit machine-readable evidence in CI and use isolated local resources so the measured result is tied to the tested process rather than an unrelated service.
