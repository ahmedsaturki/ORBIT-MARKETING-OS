# Supply-chain security Actions

ORBIT uses two additional GitHub Marketplace Actions in addition to its repository-owned security controls:

- **Dependency Review** checks pull requests for vulnerable dependency changes.
- **OpenSSF Scorecard** assesses supply-chain security posture on `main` and publishes SARIF to GitHub code scanning.

All external Actions are pinned to immutable commit SHAs. The workflows are intentionally separate from the required `ci` and `security:scan` jobs so these improvements add evidence without silently replacing existing release gates.
