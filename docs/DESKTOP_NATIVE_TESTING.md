# Desktop Native Testing

How to build the Tauri binary and run the native Playwright suite
(`e2e/tauri-shell.spec.ts`, the SEC-03 capability-isolation tests) locally.

## Prerequisites

1. **Dependencies**: `pnpm install --frozen-lockfile` at the repo root.
2. **Rust toolchain**: rustup `stable-x86_64-pc-windows-msvc` plus Visual Studio
   Build Tools (MSVC linker).
3. **App icons**: a fresh checkout has no `packages/desktop/src-tauri/icons/`.
   Generate them first:

   ```sh
   node scripts/build-icon.mjs
   ```

4. **Web surface**: the Playwright `webServer` (`node scripts/static-server.mjs`)
   serves `packages/web`, so the web build must exist or the server times out:

   ```sh
   pnpm --dir packages/web build
   ```

## Build the binary

```sh
pnpm --dir packages/desktop tauri build --features e2e-cdp
```

This is the same command CI uses
(`.github/workflows/desktop-native-validation.yml`). It runs
`tauri.conf.json`'s `build.beforeBuildCommand`, produces
`packages/desktop/dist`, embeds it in the binary, and writes
`packages/desktop/src-tauri/gen/schemas/capabilities.json`.

**Do NOT use `node scripts/build-tauri.mjs`.** That script invokes `cargo`
directly, so `beforeBuildCommand` never runs, `packages/desktop/dist` is never
produced, and `tauri::generate_context!()` panics with
`The 'frontendDist' configuration is set to '"../dist"' but this path doesn't
exist` (cargo exit 101). It cannot produce a launchable app binary.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `TAURI_EXE` | first existing of: `D:/orbit-cargo-target/x86_64-pc-windows-msvc/release/orbit-marketing-os.exe`, `packages/desktop/src-tauri/target/x86_64-pc-windows-msvc/release/orbit-marketing-os.exe`, `packages/desktop/src-tauri/target/release/orbit-marketing-os.exe` | Path to the built executable the suite launches. |
| `ORBIT_CAPABILITIES_SCHEMA` | `packages/desktop/src-tauri/gen/schemas/capabilities.json` | Resolved capabilities schema checked by the capability-isolation test. |

## Elevated session required

The suite's `beforeEach` writes the WebView2 debug policy registry value
`HKCU\Software\Policies\Microsoft\Edge\WebView2\AdditionalBrowserArguments` so
the app's WebView2 exposes a CDP port. On a non-elevated session that write
fails with `ERROR: Access is denied`. Run the suite from an **elevated**
terminal.

## Run the suite

```sh
pnpm exec playwright test e2e/tauri-shell.spec.ts
```

If the executable is not found the suite skips with a message pointing back to
this document.
