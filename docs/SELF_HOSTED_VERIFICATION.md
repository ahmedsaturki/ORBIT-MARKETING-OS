# ORBIT — Zero-Cost Self-Hosted Verification

This is the fallback verification path when GitHub-hosted runners cannot start jobs.

GitHub documents repository-level self-hosted runners and custom labels for routing jobs. They are free to use with GitHub Actions; the machine is your responsibility. citeturn961641search1turn961641search3

## 1. Add the runner

In the repository:

**Settings → Actions → Runners → New self-hosted runner**

Choose the operating system and architecture of the machine, then use the registration commands GitHub displays.

Assign these custom labels during configuration:

`orbit,x64`

GitHub labels are case-insensitive. citeturn961641search0

The runner should end in a connected/listening state before it can accept the workflow. citeturn961641search1

## 2. Prepare the machine

Required toolchain:

- Node.js 22
- pnpm 10.17.1
- Rust 1.98.1+
- Git
- Playwright Chromium dependencies
- Tauri Linux dependencies when validating Linux desktop builds

The repository's pinned Rust toolchain is also checked by `verify:workspace`.

## 3. Run verification

The workflow is **manual-only**:

**Actions → Self-Hosted Verification → Run workflow**

It performs:

`install → workspace sanity → typecheck → lint → tests → coverage → runtime smoke → build → browser E2E → format → Rust fmt/check/test/clippy`

The workflow is intentionally separate from the normal hosted workflows, so an unavailable self-hosted runner cannot silently turn into a passing release gate.

## 4. Security

Use the runner for this private repository only. Keep the runner machine patched and under your control. Do not place registration tokens, license private keys, API secrets, or session data in source control.

## 5. Release rule

A successful self-hosted verification run is valid execution evidence for the corresponding technical gates, but signing, third-party platform authorization, payment configuration, and other external release prerequisites remain separate gates.
