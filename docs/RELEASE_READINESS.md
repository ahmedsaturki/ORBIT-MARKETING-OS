# ORBIT Marketing OS — Release Readiness

## Current release line

The consolidated production implementation is merged into main through PR #10. The current cleanup/native validation cut is PR #38 on top of current main.

Historical rebuild PR #2 is closed and unmerged. PR #38 is the current cleanup/native validation line removing the obsolete root Tauri/Vite surface.

## Verified execution

Main CI run 36144303102 is a real hosted execution and passed reproducible install, release sanity, secret scan, dependency audit, workspace sanity, TypeScript typecheck, Desktop IPC verification, lint, tests, coverage, runtime smoke, performance smoke, monorepo build, Playwright E2E, formatting, Rust fmt/check/test/clippy.

Main Web Deploy run 36144303202 passed the Web quality gate, including web build and Web E2E.

## Verified production web

Vercel project orbit-marketing-os currently has a READY production deployment. The production alias orbit-marketing-os.vercel.app was independently checked for landing, pricing, privacy, terms, refund, EULA, manifest, service worker, 404 behavior and security headers.

The GitHub Vercel deployment job remains conditional on repository secrets and was skipped in the latest run. The live Vercel deployment itself is real and verified.

## Native validation

PR #38 head `b0ee492275b9cd56353a3bcfcb6e2499820da7af` has exact-head CI and Rust runs active. The CI quality and Rust quality gates passed on the immediately preceding exact head before the documentation-only cleanup commit; the new exact-head CI/native runs must settle before those results are treated as final for `b0ee492...`.

## Remaining release gates

- dedicated native runtime restart/migration/crash-recovery acceptance;
- controlled real-user Telegram/LinkedIn authorization and delivery evidence;
- live multi-device CRDT network verification beyond the encrypted reconnect/convergence simulation;
- dedicated accessibility/RTL audit;
- 24-hour soak;
- signed/notarized desktop distribution;
- production mobile signing/store distribution;
- final Vercel rollback drill;
- commercial payment/billing configuration;
- final legal/commercial publication review.

## Distribution

Desktop artifacts remain validation/unsigned until signing is configured. Mobile currently produces an Android debug validation artifact. Web is live on Vercel production.

No commercial launch claim is made while release-critical gates remain open.

## Safety boundary

ORBIT deliberately excludes fingerprint spoofing, CAPTCHA bypass, anti-abuse evasion and concealed automation. External actions remain user-authorized, bounded, auditable and stopped when authentication or challenge state is ambiguous.
