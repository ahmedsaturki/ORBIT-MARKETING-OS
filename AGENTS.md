# ORBIT MARKETING OS — Agent Contract

## Mission

Build and verify a local-first marketing operations product with explicit user control, strong local data protection, and maintainable cross-platform boundaries.

## Non-negotiable engineering rules

- Never claim a feature is implemented until its code path, tests, build, and documented acceptance criteria are verified.
- TypeScript uses strict mode and does not permit `any`.
- Rust code must propagate or handle errors; no production `unwrap()` or `expect()`.
- Secrets, access tokens, cookies, and session material must never be written to logs.
- Sensitive local data must be encrypted at rest.
- Destructive or externally-visible actions require explicit user intent.
- Platform integrations must respect the target platform's terms, rate limits, and user-visible safety controls.
- Do not implement mechanisms intended to evade platform detection, defeat CAPTCHAs, spoof fingerprints, bypass access controls, or conceal automated activity.
- CAPTCHA, unexpected authentication challenges, permission errors, or UI/schema changes stop the affected workflow and surface a human-intervention state.
- Tests are part of the feature, not a later phase.

## Definition of done

A change is done only when:

1. implementation exists;
2. automated tests cover critical behavior;
3. typecheck/lint/build pass;
4. error paths are handled;
5. security implications are reviewed;
6. documentation matches actual behavior;
7. acceptance evidence is recorded in the PR/commit history.

## Architecture

The target structure is documented in `docs/ARCHITECTURE.md`. The current repository is being migrated incrementally, so existing root-level UI code must remain functional until its replacement is verified.
