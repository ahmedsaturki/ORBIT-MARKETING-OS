# ORBIT Marketing OS — Release Readiness

## Current release line

The consolidated production implementation is merged into main through PR #10. Current main HEAD is 9edaede0f9e01d118829f4592ef90cde10147aa9.

Historical rebuild PR #2 is closed and unmerged. PR #27 is the current cleanup line removing the obsolete root Tauri/Vite surface.

## Verified execution

Main CI run 36126479828 is a real hosted execution and passed reproducible install, release sanity, secret scan, dependency audit, workspace sanity, TypeScript typecheck, Desktop IPC verification, lint, tests, coverage, runtime smoke, performance smoke, monorepo build, Playwright E2E, formatting, Rust fmt/check/test/clippy.

Main Web Deploy run 36126479836 passed the Web quality gate, including web build and Web E2E.

## Verified production web

Vercel project orbit-marketing-os currently has a READY production deployment. The production alias orbit-marketing-os.vercel.app was independently checked for landing, pricing, privacy, terms, refund, EULA, manifest, service worker, 404 behavior and security headers.

The GitHub Vercel deployment job remains conditional on repository secrets and was skipped in the latest run. The live Vercel deployment itself is real and verified.

## Native validation

PR #27 currently has successful main-style quality and Rust gates, successful Windows/Linux/macOS-arm64 and Windows desktop builds, with macOS-x64 and Android debug validation still in progress.

## Remaining release gates

- dedicated native runtime restart/migration/crash-recovery acceptance;
- controlled real-user Telegram/LinkedIn authorization and delivery evidence;
- encrypted CRDT transport and multi-device convergence;
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
