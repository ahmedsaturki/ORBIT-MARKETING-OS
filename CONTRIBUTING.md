# Contributing to ORBIT Marketing OS

## Development principles

ORBIT is a local-first, workspace-scoped marketing operating system. Changes should preserve deterministic behavior, explicit authorization boundaries, and truthful release evidence.

Before opening a pull request:

1. Keep the existing package manager and lockfiles authoritative.
2. Run the narrowest relevant typecheck, lint, tests, and build locally.
3. Add or update regression coverage for behavior changes.
4. Do not add credentials, tokens, cookies, generated secrets, or private customer data.
5. Keep external integrations fail-closed when authorization or platform state is unknown.
6. Do not claim a feature is production-proven from source presence or a green CI run alone.

## Pull requests

The PR template requires a change summary, verification evidence, risk notes, and release-impact statement.

CI includes static analysis, dependency checks, browser quality checks, and native validation. Some gates are report-first because they measure historical baseline debt rather than newly introduced defects.

## External connectors

Connector changes must remain within documented platform permissions and must not bypass CAPTCHA, anti-abuse systems, rate limits, access controls, or other platform safeguards.

For real connector verification, use controlled user-authorized test accounts and record the resulting evidence separately from fixture-only tests.
