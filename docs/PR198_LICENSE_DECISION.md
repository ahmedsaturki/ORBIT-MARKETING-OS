# ORBIT-MARKETING-OS — cargo-deny License Decision

**Date:** 2026-10-04
**Status:** owner decision required
**Related:** PR #198 (`cargo-quality.yml` + `deny.toml`)

## The claim being checked

An earlier audit note recorded: _"cargo-deny fails on missing license field —
requires legal decision (proprietary, non-SPDX, or `license-file`)."_

That framing is **wrong on the mechanism**. Here is what the files actually say.

## What `deny.toml` in PR #198 contains

```toml
[licenses]
allow = [ ...list... ]

[licenses.private]
ignore = true

[[licenses.exceptions]]
allow = ["CDLA-Permissive-2.0"]
```

`[licenses.private] ignore = true` tells cargo-deny to skip the unlicensed check
for private (non-published) crates. That is exactly what
`packages/desktop/src-tauri/Cargo.toml` is.

## What PR #198 actually changes in Cargo.toml

```diff
 [package]
 edition = "2021"
+publish = false
```

It adds **`publish = false`**, not a license. Combined with
`[licenses.private] ignore = true`, cargo-deny will not demand a license for this
crate.

## Why the earlier claim looked plausible

`packages/desktop/src-tauri/Cargo.lock` contains 505 packages, and **none** of them
carries a `license` field. That is normal — `Cargo.lock` does not record license
metadata at all. cargo-deny resolves licenses from the crates.io index or the
vendored `Cargo.toml` of each dependency, not from the lockfile.

So the observation "no license fields" is true and completely irrelevant to
whether cargo-deny passes.

## What the actual decision is

Three options, in order of preference:

| Option                                | Effect                                                                                                          | Risk                                                                                              |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **A. `publish = false` only**         | Matches #198. `cargo-deny` skips the license check for the local crate. Dependencies are still license-checked. | None for the build. Legally the crate is unlicensed, which is fine for something never published. |
| **B. Add `license = "UNLICENSED"`**   | Explicit. Standard crates.io convention for proprietary code.                                                   | None technically. Still needs the owner's agreement on how the product is licensed.               |
| **C. Add `license-file = "LICENSE"`** | Points at a real file. Requires deciding the license text.                                                      | Blocked on the owner choosing a license.                                                          |

**Recommendation: A.** It matches #198 exactly, adds nothing new, and unblocks
cargo-deny without a legal decision. If the owner wants the crate to be
publishable later, B or C becomes necessary then.

## What this does NOT change

Adopting #198 still requires the owner's decision on which of its 13 security
workflows to take. This file only settles the license sub-question, which turns out
not to be a blocker at all.

## Do the dependencies actually pass #198's allowlist?

This is the question that decides whether cargo-deny goes green, and it can be
answered from the local registry cache without network access:

```bash
cd packages/desktop/src-tauri
CARGO_HOME=D:/orbit-cargo-home CARGO_TARGET_DIR=D:/orbit-cargo-target \
  cargo metadata --offline --format-version 1 > meta.json
```

The dependency graph holds **504 crates** and **33 distinct license expressions**.
#198's `deny.toml` allows 14 SPDX identifiers. Comparing the expression trees
(not string equality — `MIT OR Apache-2.0` is permitted because MIT is on the list):

| Result                     | Count |
| -------------------------- | ----- |
| Dependency crates          | 504   |
| Satisfied by the allowlist | 502   |
| Unresolved                 | 2     |

Sixteen crates mention an identifier that is _not_ on the list — `Unlicense`,
`LGPL-2.1-or-later`, `BSD-1-Clause`, `MIT-0`, `BSL-1.0` — but every one is an
`OR` expression whose other branch is allowed, so all sixteen pass.

**The two unresolved are `same-file 1.0.6` and `walkdir 2.5.0`**, both declaring
`license = "Unlicense/MIT"`. That is deprecated SPDX slash syntax, and its
meaning (`Unlicense OR MIT`) is unambiguous — but whether cargo-deny normalizes
the legacy form is version-specific and **was not verified here**, because
running cargo-deny locally needs a build and the disk cannot hold one.

If it does not normalize the legacy slash form, the fix is one line in
`deny.toml` — either add `Unlicense` to the `[licenses] allow` list, or extend an
`[[licenses.exceptions]]` block, which #198 already has for `CDLA-Permissive-2.0`.
CI settles it in about four minutes, which is cheaper than installing cargo-deny
locally on a full disk.

## Reproducing the checks

```bash
# The license-bearing declaration
grep -nE "^(name|version|publish|license)" packages/desktop/src-tauri/Cargo.toml

# The lockfile has no license metadata — expected, and not what cargo-deny reads
grep -c "^license" packages/desktop/src-tauri/Cargo.lock   # 0

# #198's actual Cargo.toml change
gh api repos/ahmedsaturki/ORBIT-MARKETING-OS/pulls/198/files --paginate \
  --jq '.[] | select(.filename=="packages/desktop/src-tauri/Cargo.toml") | .patch'
# → +publish = false
```
