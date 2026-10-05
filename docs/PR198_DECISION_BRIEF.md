# ORBIT-MARKETING-OS — PR #198 Decision Brief

**Date:** 2026-10-04
**Status:** owner decision required
**PR:** #198 `quality: broaden CI verification beyond security`

## Why this needs a decision

PR #198 is `mergeable=CONFLICTING` against both `main` and this branch. It
touches 20 files, and 5 of them are files this audit has already modified:

| File                                    | Status here            | #198     |
| --------------------------------------- | ---------------------- | -------- |
| `.github/workflows/ci.yml`              | exists, audit-modified | modifies |
| `.github/workflows/release-desktop.yml` | exists, audit-modified | modifies |
| `docs/SECURITY_EXCEPTIONS.md`           | exists, audit-modified | modifies |
| `package.json`                          | exists, audit-modified | modifies |
| `pnpm-workspace.yaml`                   | exists, audit-modified | modifies |

Resolving those conflicts is a judgement call about which audit changes survive,
which is not something to do unilaterally.

## What #198 actually adds

Seven new files, none of which conflicts:

| File                                                 | Purpose                             |
| ---------------------------------------------------- | ----------------------------------- |
| `.github/workflows/codeql.yml`                       | CodeQL for JS/TS and Rust           |
| `.github/workflows/cargo-quality.yml`                | cargo-deny: licenses, bans, sources |
| `.github/workflows/actions-quality.yml`              | workflow hygiene (zizmor)           |
| `.github/workflows/links.yml`                        | Lychee doc-link checking            |
| `.github/workflows/lighthouse.yml`                   | Lighthouse CI on the web export     |
| `deny.toml`                                          | the cargo-deny policy               |
| `.lighthouserc.json`, `.lycheeignore`, `.zizmor.yml` | config for the above                |

Plus `docs/QUALITY_AND_RELEASE_ACTIONS.md`, `docs/SECURITY_ACTIONS.md`, and a
contract test `scripts/audit-exceptions-contract.test.mjs`.

## Two of these already exist elsewhere

`dependency-review.yml` and `scorecard.yml` are **also** added by PR #196. Only
#196 carries the braces patch alongside them. If both merge, the later one wins
and the conflict needs resolving deliberately, not by `ours`/`theirs`.

## The cargo-deny license question is already answered

An earlier note listed "missing `license` field" as a blocker requiring a legal
decision. That is retracted — see `docs/PR198_LICENSE_DECISION.md`. Short
version: #198 adds `publish = false` and `deny.toml` sets
`[licenses.private] ignore = true`, which exempts the local crate. No legal
decision is needed.

What remains genuinely unverified is narrower: 502 of 504 dependency crates
satisfy the allowlist once SPDX expressions are evaluated properly. Two
(`same-file`, `walkdir`) use the legacy `Unlicense/MIT` slash syntax, and whether
cargo-deny normalizes that is version-specific. **The cheapest way to settle it is
to merge and let CI run** — about four minutes — rather than installing cargo-deny
on a full disk.

## The rest of the PR queue

So #196 and #198 are the two worth reviewing. The duplicate pairs below were
checked by hashing normalized patch content (not filenames — identical file
lists can still carry different diffs):

| Pair        | Result                                                                                                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| #190 / #196 | **differ** — #196 adds the braces patch, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `docs/SECURITY_EXCEPTIONS.md` and the contract test on top of the same 2 workflows |
| #189 / #197 | **identical patch content**, different branches (`fix/native-e2e-current-main` vs `fix/native-e2e-main-20261003-v2`)                                                                 |
| #192 / #195 | **identical patch content**, 7 files each                                                                                                                                            |
| #186 / #198 | **differ** — same title, different scope (see above)                                                                                                                                 |

#189, #192 and #190 are safe to close in favour of #197, #195 and #196. That is a
repository-hygiene action, not a release gate, and this audit has not closed
anyone else's PR.

## Options

**A. Take only the seven non-conflicting new files.** Brings CodeQL, cargo-deny,
Lighthouse, Lychee, and zizmor in without touching anything the audit changed.
Resolves the license and braces questions by leaving existing policy alone. Leaves
`dependency-review` and `scorecard` to #196.

**B. Merge #198 whole and rebase this branch's five modified files on top.**
Maximum coverage, but every conflict is a chance to silently drop an audit fix.
Requires re-running the full local gate set afterwards.

**C. Defer #198 entirely.** The audit's own gates already cover `verify:*`,
coverage, clippy, fmt, and the 379 JS / 182 Rust tests. CodeQL and cargo-deny add
supply-chain scanning this repo does not currently do, but nothing in the release
verdict depends on them: the verdict is NOT READY because of owner gates, not
because of missing security scanning.

## Recommendation

**A**, then **C** for the rest.

Take the seven new workflow files if you want CodeQL and cargo-deny — they are
genuinely additive and conflict-free. Leave the five modified files to a separate,
deliberate merge. Do not let a `CONFLICTING` PR be force-merged over an audit
branch that retracted five false claims.

Whichever is chosen, the release verdict does not move. It is
**NOT READY — 0 of 13 gates at `L3_PRODUCTION_PROVEN`**, with 5 owner gates and 9
owner actions outstanding. None of the 9 is a security-scanning task.
