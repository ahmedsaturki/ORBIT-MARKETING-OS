# ORBIT Release Evidence — 2026-09-26

## Canonical main

Current `main` head: `d22b97aaca33d5331d6572b379020266044fbca3`.

The current main commit contains the governed Command Dispatcher, the explicit Accessibility/RTL CI gate, and reconciled release documentation.

## Exact-head feature evidence

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

## Current main continuous verification

- CI run `36204143746` — success
- Web Deploy run `36204143707` — success

## Current public web evidence

Vercel project: `orbit-marketing-os` (`prj_XL2WKssI4tzw4Wd5OQw4Pb1v6dMt`).

Current production deployment:

- `dpl_ArWWejDP95byUt84SM7HzN7kbFk3` — READY, production alias active
- READY
- production alias: `orbit-marketing-os.vercel.app`
- selected 7-day runtime error aggregation: no runtime errors
- live home fetch: HTTP 200
- observed deployed document title: `ORBIT Marketing OS`
- observed document language/direction: `ar` / `rtl`

The Vercel project metadata still reports `framework: vite`, while the repository contract targets a Next.js static export under `packages/web/out`. The deployment metadata currently has empty Git provenance. This remains a provenance/configuration blocker rather than a web-availability failure.

## Still-open evidence

The following remain intentionally unclaimed until fresh evidence exists or the external prerequisite is available:

- dedicated full native restart/migration/crash-recovery drill;
- controlled real Telegram authorization/delivery;
- controlled real LinkedIn authorization/publishing;
- live multi-device CRDT network evidence;
- dedicated full accessibility/WCAG audit beyond the automated structural Accessibility/RTL CI gate;
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
