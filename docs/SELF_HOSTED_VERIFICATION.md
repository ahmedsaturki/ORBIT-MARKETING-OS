# ORBIT — Zero-Cost Self-Hosted Verification

This is the fallback verification path when GitHub-hosted runners cannot start jobs or when a fully owned execution path is preferred.

GitHub documents repository-level self-hosted runners and custom labels for routing jobs. They are free to use with GitHub Actions; the machine is your responsibility. citeturn961641search1turn961641search3

## 1. Add the runner

In the repository:

**Settings → Actions → Runners → New self-hosted runner**

Choose the operating system and architecture of the machine, then use the registration commands GitHub displays.

Use an x64 self-hosted runner. The workflows route to `self-hosted, x64`; no custom `orbit` label is required.

The runner should end in a connected/listening state before it can accept the workflow. citeturn961641search1

## 2. Prepare the machine

Before the verification workflow can run, generate and commit the real lockfile once:

Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\\scripts\\bootstrap-lockfile.ps1
```

Linux / WSL / macOS:

```bash
bash ./scripts/bootstrap-lockfile.sh
```

Review `pnpm-lock.yaml` and commit it to the rebuild branch. Do not hand-write or fabricate the lockfile.

Required toolchain:

- Node.js 22
- pnpm 10.17.1
- Rust 1.98.1 (repository-pinned)
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


## One-click lockfile bootstrap

After the self-hosted x64 runner is registered, use:

**Actions → Bootstrap Lockfile → Run workflow**

The workflow generates the real `pnpm-lock.yaml` with pnpm 10.17.1 and commits it to the selected branch. No hand-written lockfile is used.

Then run:

**Actions → Self-Hosted Verification → Run workflow**

The verification workflow consumes that committed lockfile with `pnpm install --frozen-lockfile`.
