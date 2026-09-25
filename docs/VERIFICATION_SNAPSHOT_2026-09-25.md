# ORBIT Verification Snapshot — 2026-09-25

## Canonical state

- Default branch: `main`
- Current main HEAD at snapshot: `929aaa49aa435761c2a87925d67a0749f70ae287`
- PR #37 merged: governed marketing operating model foundation is on main.
- PR #38 is the current release/native cleanup line and is the authoritative validation surface for this cut.

## Verified main foundation

The merged main lineage includes:

- local-first desktop/runtime ownership;
- workspace-aware operations;
- secure vault/audit primitives;
- persistent task/approval flows;
- Telegram native and LinkedIn capability-scoped connector paths;
- governed Strategy, Knowledge, Agent, Policy, and Operations contracts;
- product blueprint documenting the Strategy → Campaign → Content → Execution → CRM/Inbox → Analytics → Learning graph.

## Current release validation

PR #38 is validating:

- canonical `packages/desktop` Tauri paths;
- removal of the obsolete root Vite/Tauri UI/runtime surface;
- Desktop Windows/Linux/macOS bundle matrix;
- Windows native E2E, including renderer capability isolation and workspace/recovery scenarios;
- Android debug validation;
- Vercel static-export dry-run guards;
- current release/verification scorecards.

The current PR must not be treated as production-ready until its exact-head runtime/native evidence settles.

## Live web

The connected `orbit-marketing-os` Vercel project has a READY production deployment and the public web surface has been independently checked for the current routes, manifest/service worker, 404 handling, and expected browser security headers.

The effective Vercel project metadata still requires reconciliation because it reports `framework: vite` while the repository contract targets a Next.js static export.

## Remaining release gates

Implementation presence is not release evidence. Remaining gates include:

- exact-head native desktop and Android validation;
- dedicated real-instance crash/restart/migration recovery;
- controlled real Telegram authorization/delivery test;
- controlled real LinkedIn authorization/publishing test;
- live multi-device CRDT network evidence;
- accessibility/RTL audit;
- 24-hour soak and recovery evidence;
- checksum/provenance verification for the final release;
- desktop signing/notarization;
- Android/iOS production signing and store distribution;
- Vercel guarded deployment provenance and rollback drill;
- payment/refund configuration and final legal/commercial review.

## Evidence rule

Only current execution records, artifacts, or controlled human-authorized tests may move an applicable gate to VERIFIED. No source-only or historical result is copied forward as current evidence.
