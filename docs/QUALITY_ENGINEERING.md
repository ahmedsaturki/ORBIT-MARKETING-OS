# ORBIT Quality Engineering Gates

This layer complements the existing product CI rather than replacing it.

| Area | Workflow | Purpose | Blocking policy |
|---|---|---|---|
| Code analysis | CodeQL | Detect security-relevant dataflow/code patterns in TypeScript/JavaScript and Rust | Findings are surfaced through code scanning |
| Workflow integrity | actionlint + zizmor | Validate workflow syntax and audit GitHub Actions security posture | actionlint blocks; zizmor is advisory while the baseline is established |
| Web experience | Lighthouse CI | Measure performance, accessibility, best practices, SEO, and PWA behavior against the real static export | Report-first; budgets can be tightened after baseline |
| Documentation | markdownlint-cli2 | Detect documentation structure/style defects across README and docs | Advisory initially to avoid converting historical debt into a release blocker |

All third-party Actions are pinned to immutable commit SHAs.

The existing required `ci` and `security:scan` workflows are not modified by this layer.
