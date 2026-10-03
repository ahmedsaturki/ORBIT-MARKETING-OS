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

## GHSA-vfj7-8cjw-p6xm / CVE-2026-93687 — temporary governed exception

Status: **EXCEPTION_ACTIVE — REVIEW REQUIRED**

Reason: the currently published `braces` release is `3.0.3`, while the advisory marks it affected and the upstream project has not published a fixed release. Upstream PR #72 contains the proposed nesting-depth fix but remains open and unmerged.

Mitigations required by this exception:

- `patches/braces@3.0.3.patch` is committed and wired through `patchedDependencies`.
- `scripts/dependency-audit-exceptions.test.mjs` verifies the patch artifact hash, lockfile binding, exact advisory allow-list, and runtime regression behavior.
- The runtime regression rejects deeply nested brace input and verifies the supported lower `maxDepth` behavior.
- Any other moderate/high/critical advisory remains a CI failure.
- The exception has the same mandatory review date of **2026-11-03**.

Removal conditions:

1. A released upstream `braces` version fixes this advisory; upgrade and remove the patch/exception.
2. Or the dependency path disappears from the shipped dependency graph; prove it with a fresh frozen install and audit.
3. Keep regression coverage until the replacement is independently verified against the same nested-input failure mode.

This is an explicit, narrow exception with compensating controls; it is not a blanket audit suppression.

Implementation note — braces 3.0.3

- pnpm 10 regenerated and accepted the patch lock entry with canonical patch hash `f7b8577c6aa409a18d650762cce9bae178d30e4c9dbacf017b9fa94e46f788d1`.
- The canonical hash is intentionally treated as a pnpm patch identifier, not as a raw SHA-256 claim.
- Upstream `micromatch/braces#72` remains the source of the runtime backport while no fixed published release is available.
