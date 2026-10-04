# ORBIT Security Exception Register

Updated: 2026-10-03

## GHSA-86w9-cpqp-85rv / CVE-2026-85393 — temporary governed exception

Status: **EXCEPTION_ACTIVE — REVIEW REQUIRED**

Reason: the current published `node-forge` release is `1.4.0`, while the advisory marks `1.4.0` as affected and provides no released patched version. The repository therefore cannot clear this finding through a normal version upgrade at this time.

Mitigations required by this exception:

- `patches/node-forge@1.4.0.patch` is committed and wired through `patchedDependencies`.
- `packages/mobile/test/nodeForgeDigestInfo.test.ts` is a load-bearing regression test for the forged nested `DigestAlgorithm` signature.
- CI runs `pnpm test:node-forge-audit-exception` before `pnpm audit`.
- Only the exact GHSA `GHSA-86w9-cpqp-85rv` is ignored by pnpm's audit filter.
- Any other moderate/high/critical advisory remains a CI failure.
- The exception has a mandatory review date of **2026-11-03** and the contract fails after that date.

Removal conditions:

1. A released upstream `node-forge` version fixes this advisory; upgrade and remove the patch/exception.
2. Or the dependency path disappears from the shipped dependency graph; prove it with a fresh frozen install and audit.
3. Do not remove the regression test until the replacement dependency is independently verified against the same PoC and genuine-signature regression.

This is an explicit, narrow security exception with compensating controls; it is not a silent suppression of the audit system.
---

## GHSA-vfj7-8cjw-p6xm — braces — EXCEPTION_ACTIVE — REVIEW REQUIRED

Status: **EXCEPTION_ACTIVE — REVIEW REQUIRED**

Reason: `braces@3.0.3` is the newest published version and the advisory
declares `firstPatchedVersion: null`, so there is no upgrade that clears this
finding. The vulnerability is stack exhaustion when compiling deeply nested
glob patterns.

Exposure analysis: `braces` reaches this repository only transitively, through
Expo/Metro bundler tooling under `packages/mobile`. It is not a direct
dependency of any shipped package and is not part of a runtime artifact. The
exposed surface is code that compiles glob patterns, which here runs at build
time over repository-controlled patterns rather than attacker-supplied input at
runtime.

Mitigations required by this exception:

- `scripts/braces-audit-exception.test.mjs` is the governing contract and runs
  in CI before `pnpm audit`.
- The contract asserts the audit allowlist contains exactly the two governed
  advisories, so this exception cannot silently widen.
- The contract asserts `braces` is not declared in the `dependencies` or
  `optionalDependencies` of any shipped package, so the build-time-only
  assumption is checked rather than asserted.
- The contract asserts the pinned version matches the latest published
  version, so an upstream fix forces an upgrade decision.
- Only `GHSA-86w9-cpqp-85rv` and `GHSA-vfj7-8cjw-p6xm` are ignored by pnpm's
  audit filter; any other moderate/high/critical advisory remains a failure.
- Mandatory review date of **2026-11-03**; the contract fails after that date.

### Contract runtime notes

- The "pinned version matches the latest published version" check queries the
  npm registry, so `pnpm test:braces-audit-exception` needs network access and
  fails closed if the registry is unreachable. It previously read
  `const latest = MAX_INSTALLED_VERSION` and compared that constant against the
  lockfile, which could never fail: neither a newer `braces` release nor a
  second `braces` version in the lockfile was detected. The advisory's upgrade
  trigger was documented but unenforced until this check was made real.
- The review date is inclusive. `2026-11-03` is a valid day to perform the
  review; the contract fails from `2026-11-04T00:00:00Z`. The previous
  comparison against `2026-11-03T00:00:00Z` expired the exception on the morning
  the review was still due, which contradicted the wording used here.

Removal conditions:

1. A released upstream `braces` version fixes this advisory; upgrade and remove
   the ignore entry.
2. Or the Expo/Metro dependency path disappears; re-run the contract and audit.
3. Re-assess the exposure analysis if `braces` ever becomes reachable at runtime.

This is an explicit, narrow security exception with compensating controls; it
is not a silent suppression of the audit system.
