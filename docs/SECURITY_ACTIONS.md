# Supply-chain security Actions

ORBIT uses two additional GitHub Marketplace Actions that are available for this public repository without a paid service:

- **Dependency Review**: checks pull requests for vulnerable dependency changes before merge.
- **OpenSSF Scorecard**: performs a supply-chain security assessment on `main`, publishes results for public-repository scoring, and uploads SARIF to GitHub code scanning.

All external Actions are pinned to immutable commit SHAs in the workflows rather than floating tags.

## Current pinned revisions

| Action | Revision | Release |
|---|---|---|
| `actions/dependency-review-action` | `a1d282b36b6f3519aa1f3fc636f609c47dddb294` | v5.0.0 |
| `ossf/scorecard-action` | `2d1146689b8cda280b9bc96326124645441f03bc` | v2.4.4 |
| `github/codeql-action/upload-sarif` | `f205ea1c3313d32999d8d6a48b4f6530d4437b38` | v4.37.4 |
| `actions/upload-artifact` | `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` | v7.0.1 |

The workflows are intentionally separate from the required `ci` and `security:scan` jobs so these improvements do not silently alter the existing release gate until their behavior is observed.
