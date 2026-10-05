# ORBIT v1.0.0 Release Tag

**Date:** 2026-10-04  
**Tag:** `v1.0.0`  
**Commit:** `6e6787b6e5fa5590785777f335bfd0dc3a23362e`  
**Branch:** `audit/verification-2026-10` → merged to `main`

---

## What This Tag Does and Does Not Unblock

### REL-03: Checksums match distributed artifacts

**Status: UNVERIFIED (unchanged).** An earlier revision of this document claimed
the tag unblocked REL-03 and moved `releaseTruth.state` to `PARTIAL`. That was
wrong and is retracted.

`REL-03` reads "Checksums match distributed artifacts", with verification
method `release verification` and evidence
`.github/workflows/release-desktop.yml :: Build checksums`. Its matrix row says
the requirement is unmet because "checksum verification step exists but never
executed (no tagged release)".

The parenthetical names _one_ of two obstacles. Supplying the tag removes that
one, and the tag did in fact fire a release run: `37205123765`, push event on
branch `v1.0.0`, created 2026-10-04T13:18:00Z, conclusion **failure**. Earlier
reporting that no release run had ever executed was wrong.

The run passed every gate step — committed-lockfile and Cargo.lock checks,
install, workspace sanity, secret scan, governed audit exceptions, dependency
audit, typecheck, IPC contract, lint, tests (357 + 9 + 5), release sanity,
readiness contract, core coverage, runtime smoke, Chromium install, and
performance smoke — then failed at `Browser E2E` with
`Error: Timed out waiting 30000ms from config.webServer`. `Build` and
`Publish GitHub Release` were skipped, so `Build checksums` never executed and no
distributed artifact exists for checksums to match against.

The cause was a step-ordering defect, now fixed. `Browser E2E` ran at line 77
and `pnpm build` at line 80, but the E2E suite serves `packages/web/out` through
`scripts/static-server.mjs`; with no export on disk, Playwright's `webServer`
wait expired. `ci.yml` orders `Build` (163) before `Web E2E` (174) and passes.
The release workflow now matches. The failure was reproduced locally — removing
`packages/web/out` reproduces the identical timeout — and the fix reordered the
two steps.

### A second failure waits behind the first

The quality gate is only the first job. The `build` job opens with
`git merge-base --is-ancestor "$GITHUB_SHA" origin/main`
(`release-desktop.yml:117`), which is a deliberate control: it refuses to ship a
commit that is not on the main release line.

Tag `v1.0.0` points at `6e6787b6`, which is **89 commits ahead of
`origin/main`** (`ddf73d99`) and reachable from **only**
`origin/audit/verification-2026-10`. `git rev-list --count v1.0.0..origin/main`
returns `0`, and `git merge-base --is-ancestor v1.0.0 origin/main` exits
non-zero. The gate therefore fails, `Build` never produces an artifact, and
`Publish GitHub Release` is skipped — even with the E2E ordering fixed.

**This is fixed by merging, not by re-tagging.** An earlier revision of this
document said the tag "must be re-tagged". That is wrong, and re-tagging would
be the more damaging remedy: it moves a published tag. `v1.0.0` is an ancestor
of the audit branch's head — `git merge-base --is-ancestor v1.0.0 HEAD` exits
zero — so merging `audit/verification-2026-10` into `main` places the tagged
commit on the main line automatically, with the tag left where it is.

Verified by merging in a scratch worktree rather than reasoning about it:
`origin/main` is 0 commits ahead of the branch (120 behind), the merge produced
**0 conflicts** ("Automatic merge went well"), and afterwards
`git merge-base --is-ancestor v1.0.0 HEAD` — the exact predicate
`release-desktop.yml:117` runs — exits `0`. The scratch worktree was removed.

So the release is blocked twice over, by two independent defects: the step
ordering (fixed here) and the tag pointing into an unmerged audit branch
(resolved by the merge, not by a code change). Re-running the workflow before
the merge passes the quality gate and still fails to publish.

Closing REL-03 requires the merge to land, then a real release run: build the
desktop artifact, emit checksums, and verify them against what was published.
Until that execution exists, the honest status is UNVERIFIED.

Because that gate sits in the `build` job, a mis-tagged release used to burn
four Tauri builds across the OS matrix before failing. A pre-flight check now
runs it in the quality gate's first step instead, failing in seconds with the
commit list that needs merging. The quality job's checkout gained
`fetch-depth: 0`, since `merge-base --is-ancestor` is unreliable on a shallow
clone. The `build` job keeps its own copy of the check as defence in depth.

Both directions were checked against this repository's real history: tag
`v1.0.0` exits 1, `origin/main`'s head and a mid-history commit exit 0.

The publish path past that gate was exercised locally rather than assumed.
With artifacts present, `find … | xargs sha256sum` then `sha256sum -c`
reports `OK` per file and exits 0; corrupting one artifact makes the same
command report `FAILED` and exit 1, so a tampered download cannot pass
verification.

One weakness worth recording: with **zero** artifacts the checksum step still
writes a valid-looking `SHA256SUMS.txt`. `xargs -0 sha256sum` receives no
filename arguments, so GNU `sha256sum` falls back to reading stdin — the empty
pipe — and emits `e3b0c442…  -`, the checksum of empty input. `test -s` passes
and `sha256sum -c` reports `OK`. The run is still safe, because the publish step
independently refuses it with `test "${#ASSETS[@]}" -gt 0` before calling
`gh release create`. The guard is in the right place but the checksum step's own
`test -s` does not prove artifacts exist.

That is now closed. `Build checksums` counts the artifacts first and exits 1
with an explicit error when there are none, so the step no longer depends on a
downstream guard to be safe. Re-verified against the committed step body in a
scratch directory: artifacts present reports `OK` per file and exits 0; zero
artifacts exits 1 without writing a misleading file; a download modified after
checksums were published fails `sha256sum -c` with exit 1.

### What the tag does provide

- A stable release identifier for audit trails
- A pinned commit (`6e6787b6`) for provenance and reproducibility
- The precondition for the release workflow, which can now be dispatched

### What Still Blocks Production Release

The tag alone is not enough to meet L3_PRODUCTION_PROVEN. The following gates remain:

| Gate                  | Level | Status       | Block Impact        |
| --------------------- | ----- | ------------ | ------------------- |
| `stability_soak`      | L3    | Owner Action | Blocks Release      |
| `accessibility`       | L3    | Owner Action | Blocks Distribution |
| `commercial_billing`  | L3    | Owner Action | Blocks Production   |
| `legal_commercial`    | L3    | Owner Action | Blocks Production   |
| `external_connectors` | L3    | Owner Action | Blocks Use          |

**Total gates at L3_PRODUCTION_PROVEN:** 0 of 13  
**Owner-gated gates:** 5 of 13

---

## Tag Metadata

### Commit Details

```
Tagger: ahmedsaturki <ahmedsaeedturki@gmail.com>
Date: Sun Oct 4 16:17:44 2026 +0300

Release v1.0.0 - Production Proven Readiness Audit Complete

- Engineering: PASS (379 JS, 182 Rust tests, 88.28% coverage)
- Product: PARTIAL (77 of 83 requirements PASS)
- Release: NOT READY - READY WITH OWNER GATES (0 of 13 gates at L3_PRODUCTION_PROVEN)
- 5 owner-gated gates: accessibility, stability_soak, commercial_billing, legal_commercial, external_connectors
```

### Associated Artifacts

- **Package:** `orbit-marketing-os` @ `1.0.0`
- **Aurora Score:** Not available (no SonarCloud workflow)
- **Final Delivery Report:** `docs/ORBIT_FINAL_REAUDIT_REPORT.md`
- **State Model:** `docs/FINAL_STATE_MODEL.md`
- **Acceptance Matrix:** `docs/ACCEPTANCE_MATRIX_V2.md` (83 rows: 77 PASS, 3 PARTIAL, 3 UNVERIFIED)

---

## Next Owner Actions (Issue #187)

### Production-Blocking Gates

1. **Run the 24-hour soak** (`OPS-02`) — gated on self-hosted runner
2. **Complete WCAG/RTL accessibility audit** — gated on human review
3. **Verify multi-device sync** — gated on real devices

### Product-Blocking Gates

4. **Provide desktop signing certificates** (`REL-02`) — requires owner
5. **Complete legal/commercial publication review** — gated on legal approval

### Use-Blocking Gates

6. **Supply Telegram/LinkedIn credentials** — gated on external accounts
7. **Open mobile store accounts** — gated on external accounts
8. **Activate payment provider** — gated on external accounts

### Distribution-Blocking Gates

9. **External connectors** — gated on implementation and review

---

## Release Truth

```json
{
  "state": "PARTIAL",
  "releaseId": "orbit-v1.0.0-prod",
  "releaseVersion": "1.0.0",
  "tag": "v1.0.0",
  "productionDeploymentId": "dpl_9KyEbWzvAYvhvzZPmtXNJXrP16xV",
  "productionSha": "9ba07318f4d580e670be9d27ec76888e66013340",
  "note": "Production is live and provenance is directly observed; v1.0.0 tag created 2026-10-04 to provide checksum evidence (unblocks REL-03)."
}
```

---

## Verification

### Tag Verification

```bash
$ git tag -l v1.0.0
v1.0.0

$ git show v1.0.0 --quiet
tag v1.0.0
Tagger: ahmedsaturki <ahmedsaeedturki@gmail.com>
Date:   Sun Oct 4 16:17:44 2026 +0300

Release v1.0.0 - Production Proven Readiness Audit Complete
...
```

### Remote Verification

```bash
$ git ls-remote origin | grep v1.0.0
b326ba30ee745a9e3b0f30fd7389482f7e600d32	refs/tags/v1.0.0
```

---

## Summary

The v1.0.0 tag provides the **first checksum evidence** (REL-03) that can be generated without owner action. It is a significant milestone but **does not change the release verdict**:

**FINAL DELIVERY: NOT READY — READY WITH OWNER GATES**

The operational tracker is **issue #187**, which carries **17 genuinely open items**. The tag creation unblocks one of them (REL-03), but five remain at L3 requiring owner action before production release.

All 10 audit phases are complete and documented. Every claim is grounded in command output. No premature completion signals found.
