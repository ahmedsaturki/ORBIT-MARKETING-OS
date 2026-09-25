# ORBIT Self-Hosted Runner

## Purpose

ORBIT uses a Linux self-hosted runner as the zero-cost fallback when GitHub-hosted runner allocation is unavailable. The runner is used only for the owner-triggered lockfile bootstrap and full verification workflows.

GitHub recommends self-hosted runners primarily for private repositories and warns that self-hosted environments are not ephemeral/clean. Keep this runner dedicated to ORBIT and do not run unrelated or untrusted workflows on it.

## Required labels

The ORBIT workflows require:

- `self-hosted`
- `x64`
- `linux`

Do not change the workflow labels unless the runner architecture and OS are deliberately changed.

## Register the runner

1. Open the repository's **Settings → Actions → Runners** page.
2. Choose **New self-hosted runner**.
3. Choose **Linux** and **x64**.
4. Copy the current commands GitHub generates for the runner download and configuration. Do not hard-code a runner version in this document; GitHub rotates supported runner versions.
5. Run the configuration command only on the machine dedicated to this repository.
6. Confirm the runner appears as **Idle/Online** in GitHub before dispatching workflows.

The registration token shown by GitHub is time-limited, so use the generated command promptly.

## WSL option

A Linux runner can be hosted inside Ubuntu on WSL when the WSL environment can make outbound HTTPS connections to GitHub and the required package registries. The runner process must remain running while a workflow is executing.

First validate the WSL environment:

```bash
node --version
npm --version
git --version
curl --version
```

Before registration, run `./scripts/self-hosted-preflight.sh`. It verifies Linux/WSL, Node 22, pnpm 10.17.1, Rust 1.98.1, disk space, and HTTPS access to GitHub, npm, and crates.io.

Then use GitHub's generated Linux x64 runner commands. For the first validation, run the runner interactively:

```bash
./run.sh
```

Keep the terminal open and confirm the runner reports it is connected and listening for jobs.

Once the interactive path is proven, install the runner as a service using GitHub's current Linux service instructions if the WSL distribution supports the required service manager.

## ORBIT workflow security

Both manual self-hosted workflows are:

- restricted to the approved production rebuild refs (`rebuild/orbit-production` and `rebuild/orbit-production-consolidated`);
- restricted to the repository owner account `ahmedsaturki`;
- restricted to `self-hosted, x64, linux`.

The lockfile bootstrap generates both:

- `pnpm-lock.yaml`
- `packages/desktop/src-tauri/Cargo.lock`

and pushes only the selected branch.

## Run order

1. Register and bring the runner Online.
2. Dispatch **Bootstrap lockfiles on hosted runner** on `rebuild/orbit-production-consolidated` (this is the normal path).
3. Confirm the two lockfiles appear in that branch.
4. Use the hosted `CI` workflow as the primary full verification path; use **Self-Hosted Verification** only when an owned runner is intentionally available. on `rebuild/orbit-production-consolidated`.
5. Require all quality, runtime, browser, performance, and Rust stages to pass before treating the branch as release-ready.

## Security rules

Never place platform passwords, session cookies, private keys, or API tokens in the runner working directory.
Do not use this runner for forked PRs or arbitrary branches.
Keep the runner isolated from unrelated repositories and secrets.
Keep the runner application and OS updated.
Remove the runner from GitHub when the machine is no longer dedicated to ORBIT.

## Evidence

GitHub's runner UI should show the runner as connected/idle before a job can be accepted. A job record with `runner_id=0`, an empty runner name, and no steps is not source-build evidence; it indicates runner allocation/execution infrastructure failed before workflow execution.
