# ORBIT Release Evidence — 2026-09-26

## Canonical main

GitHub currently resolves the repository default branch `main` to:

`1cb104647bc69cff114f430cab1ff9dc184ed864`

This is the authoritative branch tip for this snapshot. The connected GitHub workflow lookup returned no PR-triggered workflow runs directly attached to this SHA, so no fresh CI result is attributed to this exact commit here.

The most recent verified release-line evidence used by the repository history includes the governed Command Dispatcher, Accessibility/RTL structural gate, Research Intelligence, deterministic experimentation/learning, anomaly detection, governed agent operations, and the current Universal Search release branch.

## Current release candidate

PR #71 — `docs: reconcile current release truth`

- base: `main` at `1cb104647bc69cff114f430cab1ff9dc184ed864`
- current head: `07a0754255ee490574242ac3dbbc0ecb6cdfec6a`
- state: open
- scope: release-truth reconciliation plus Universal Search, native search E2E coverage, and competitive-intelligence documentation including the RBM surfaces supplied for the project
- current exact-head workflow runs are pending/queued; they must complete before this release line is treated as freshly validated

## Exact-head historical feature evidence

PR #48 — governed command execution dispatcher:

- head: `6dccbe5c4efcfeb77c5ff87bda3d5d707b5b0301`
- CI: run `36200698291` — success
- Desktop Native Validation: run `36200698273` — success
- Mobile Validation: run `36200698316` — success

PR #47 — governed operational command/event spine:

- head: `d48f00e93a60d9c85e191099419f659bc94e64c9`
- merged to main as `bd174e7e52a6ba69b4c54618e7a635e90bace611`
- CI: run `36198100587` — success
- Desktop Native Validation: run `36198100491` — success
- Mobile Validation: run `36198100618` — success

These historical runs remain evidence for those exact heads. They are not silently re-attributed to the current `main` SHA.

## Current public web evidence

Vercel project: `orbit-marketing-os` (`prj_XL2WKssI4tzw4Wd5OQw4Pb1v6dMt`).

Current observed production deployment:

- `dpl_ArWWejDP95byUt84SM7HzN7kbFk3` — READY
- production alias: `orbit-marketing-os.vercel.app`
- the connected Vercel deployment metadata reports framework `vite`
- the deployment metadata has empty Git provenance
- the selected seven-day Vercel runtime-error query currently reports no runtime error clusters

The deployment is therefore live, but it is not treated as proof that the canonical repository release path or current `main` SHA was the source of that production deployment.

## Still-open evidence

The following remain intentionally unclaimed until fresh evidence exists or the external prerequisite is available:

- exact-head CI/native/mobile validation for the current release candidate;
- dedicated full native restart/migration/crash-recovery drill;
- controlled real Telegram authorization/delivery;
- controlled real LinkedIn authorization/publishing;
- live multi-device CRDT network evidence;
- dedicated manual accessibility/WCAG conformance audit beyond automated structural checks;
- completed 24-hour soak evidence;
- final distributed release checksum/provenance drill;
- desktop signing/notarization;
- production mobile signing/store distribution;
- Vercel project-setting reconciliation and rollback drill;
- GitHub main branch protection/ruleset enforcement;
- commercial billing/payment configuration;
- final legal/commercial publication review.

## Rule

`IMPLEMENTED` is not `VERIFIED`; `VERIFIED` is not `PRODUCTION PROVEN`.

No commercial release is claimed while a required gate remains `UNVERIFIED` or `BLOCKED`.
