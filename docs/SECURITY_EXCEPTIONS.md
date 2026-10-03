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

## GHSA-vfj7-8cjw-p6xm — temporary governed exception

Status: **EXCEPTION_ACTIVE — REVIEW REQUIRED**

Reason: `braces` ≤ 3.0.3 is vulnerable to a stack-exhaustion denial of service through deeply nested glob patterns, and the advisory identifies no released patched version (`<0.0.0`), so the finding cannot be cleared through a normal version upgrade at this time. The vulnerable package is reachable only through the desktop/mobile **build toolchain** dependency path `packages/mobile → expo → @expo/cli → @expo/metro-file-map → micromatch → braces`; it globs developer-controlled repository paths during builds and is not part of any shipped runtime, end-user input path, or credential-handling code.

Mitigations required by this exception:

- No upgrade or patch exists upstream; there is no possible local patch against an unpublished fix.
- The vulnerable code path is exercised only on developer- and CI-controlled build inputs.
- Only the exact GHSA `GHSA-vfj7-8cjw-p6xm` is ignored by pnpm's audit filter; every other moderate/high/critical advisory remains a CI failure.
- The exception has a mandatory review date of **2026-11-03** and the contract test fails after that date.

Removal conditions:

1. A released upstream `braces` version fixes this advisory; the expo toolchain is then upgraded and the exception removed.
2. Or the dependency path disappears from the dependency graph; prove it with a fresh frozen install and audit.
