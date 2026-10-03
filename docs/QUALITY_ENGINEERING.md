# ORBIT Quality Engineering

This layer complements the existing product and release verification rather than replacing it.

## Engineering dimensions covered

| Dimension | Mechanism | Current role |
|---|---|---|
| Static code analysis | CodeQL for JavaScript/TypeScript and Rust | Detect code/dataflow findings and publish code-scanning results |
| Workflow correctness | actionlint | Blocking syntax/ShellCheck validation for GitHub Actions |
| Workflow security posture | zizmor | Audit Actions for template injection, unsafe permissions, cache poisoning, and suspicious pins |
| Dependency change safety | Dependency Review | Detect vulnerable dependency changes introduced by pull requests |
| Supply-chain posture | OpenSSF Scorecard | Assess repository supply-chain controls and publish results |
| Web experience | Lighthouse CI | Measure performance, accessibility, best practices, SEO, and PWA behavior against the actual static export |
| Documentation quality | markdownlint-cli2 + Lychee | Detect documentation structure/style issues and broken links; report-first |
| Release artifacts | SBOM + artifact attestations | Produce CycloneDX SBOMs and GitHub artifact provenance/SBOM attestations for desktop release bundles |
| Reproducibility | committed lockfiles + frozen installs | Keep dependency resolution deterministic |
| Runtime quality | existing smoke/E2E/recovery/performance suites | Validate product behavior beyond static analysis |
| Native quality | existing Rust/Desktop/Mobile validation | Validate native build and runtime surfaces |
| Developer governance | CONTRIBUTING, PR template, issue forms, CODEOWNERS | Require evidence, risk notes, ownership, and release-truth discipline |
| Link integrity | Lychee | Check external/internal links in the maintained documentation set; report-first |

## Workflow-quality findings resolved during rollout

The first real zizmor scan exposed 15 high-severity findings in the existing workflow estate:

- seven valid pinned dtolnay/rust-toolchain references that zizmor could not associate with repository history were documented as exact local impostor-commit exceptions;
- four cache-poisoning findings on release/tag workflows were addressed by disabling package-manager caching on those release paths;
- three template-injection findings in release/soak workflows were moved from GitHub expression interpolation into environment variables before shell expansion;
- one additional workflow ShellCheck finding in vercel-web.yml was fixed by grouping GITHUB_OUTPUT writes.

The current quality workflow is intended to keep these controls observable. It does not silently downgrade existing required product gates.

## Policy for new gates

New quality mechanisms start as report-first unless they protect a clearly understood invariant and have a stable, reproducible baseline. Once a baseline is understood, a focused threshold can be promoted to a blocking release gate without importing unrelated historical debt.

## Cost model

The added workflows use public/open-source Actions and GitHub-hosted execution paths. No paid monitoring service, external API credential, or application secret is required by this quality layer.
