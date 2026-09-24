# ORBIT Marketing OS — Launch Plan

## Stage 0 — Engineering baseline

- monorepo and strict TypeScript;
- Core security, licensing, queues, and connector contracts;
- Tauri desktop local vault and account persistence;
- local Ollama runtime;
- Next.js PWA surface;
- Expo mobile monitoring surface;
- automated quality workflows.

## Stage 1 — Integration beta

Validate one supported platform integration end-to-end with a test account and explicit user authorization. Record failure modes before expanding.

## Stage 2 — Product beta

Validate CRM data integrity, campaign/task persistence, confirmation and circuit-breaking, local backup/restore, licensing, RTL accessibility, and clean installation.

## Stage 3 — Release candidate

Require clean-install tests, Rust fmt/test/clippy, workspace typecheck/build/test, security review, signed artifacts, working payments, reviewed legal documents, and documented support.

## Stage 4 — Public release

Only after Stage 3 evidence is complete should web, desktop, mobile, and commercial licensing be published.

No stage provides immunity from third-party enforcement or service changes.

- [Launch Scorecard](./LAUNCH_SCORECARD.md)
