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

## Temporary braces exception — GHSA-vfj7-8cjw-p6xm

The current package audit also reports `braces@3.0.3` through the Expo CLI build-tooling path `packages__mobile>expo>@expo/cli>@expo/metro-file-map>micromatch>braces`. The published package has no patched release at the time of this review. An upstream fix exists as `micromatch/braces#72` but remains open/unmerged. The exception is limited to this exact GHSA and exact dependency path, expires on 2026-11-03, and remains fail-closed for all other advisories. The contract requires the path and version to remain visible so the exception cannot silently broaden.
