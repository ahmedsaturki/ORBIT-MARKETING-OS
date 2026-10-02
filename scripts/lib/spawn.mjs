/**
 * Cross-platform package-manager invocation for ORBIT's verification scripts.
 *
 * Node cannot execute a Windows `.cmd` shim without a shell: `spawnSync("pnpm.cmd",
 * args)` fails with `status: null` and `EINVAL`, leaving `stdout`/`stderr`
 * undefined and turning every assertion downstream into a misleading TypeError.
 * CI runs on ubuntu, so this only ever surfaced on Windows checkouts.
 *
 * This helper is the single place where the platform rule lives:
 *   - win32  -> `pnpm.cmd` through cmd.exe (`shell: true`), arguments quoted
 *   - posix  -> `pnpm` spawned directly, no shell (byte-identical to before)
 *   - `ORBIT_PNPM_BIN` overrides the resolved executable for pinned CI images.
 */
import { spawnSync } from "node:child_process";

// Windows cmd.exe metacharacters that must not reach the shell unquoted.
const CMD_META = /[\s()<>[\]^"{|}~=;'&,!?#%@`]/;

/**
 * Resolve the package-manager executable and spawn mode for a platform.
 *
 * @param {{ platform?: string, env?: NodeJS.ProcessEnv }} [options]
 * @returns {{ command: string, shell: boolean }}
 */
export function resolvePackageManager(options = {}) {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;

  const override =
    typeof env.ORBIT_PNPM_BIN === "string" ? env.ORBIT_PNPM_BIN.trim() : "";
  if (override !== "") {
    // An explicit override may itself be a `.cmd`/`.bat` shim, so the shell
    // decision follows the executable the caller actually pinned.
    const needsShell = platform === "win32" && /\.(cmd|bat)$/i.test(override);
    return { command: override, shell: needsShell };
  }

  if (platform === "win32") {
    return { command: "pnpm.cmd", shell: true };
  }
  return { command: "pnpm", shell: false };
}

/**
 * Quote one argument for cmd.exe. `cmd.exe` cannot represent a literal `"` or an
 * embedded newline in an argument, and `%VAR%` would be expanded by the shell,
 * so those are rejected instead of being silently mangled or injected.
 *
 * @param {string} value
 * @returns {string}
 */
export function quoteWindowsArgument(value) {
  if (/["%\r\n]/.test(value)) {
    throw new Error(
      `unsafe_windows_shell_argument: ${JSON.stringify(value)} contains a character that cannot be quoted safely for cmd.exe`,
    );
  }
  if (value === "" || !CMD_META.test(value)) {
    return value;
  }
  return `"${value}"`;
}

/**
 * Build the effective spawn arguments. With a shell the arguments are joined
 * into a single command line; without one they are passed as an argv array.
 *
 * @param {{ platform?: string, env?: NodeJS.ProcessEnv, args?: string[] }} [options]
 * @returns {{ command: string, args: string[], shell: boolean }}
 */
export function buildPackageManagerInvocation(options = {}) {
  const { command, shell } = resolvePackageManager(options);
  const args = options.args ?? [];
  if (!Array.isArray(args) || args.some((arg) => typeof arg !== "string")) {
    throw new Error("package_manager_args_must_be_strings");
  }
  if (!shell) {
    return { command, args: [...args], shell };
  }
  const commandLine = [command, ...args].map(quoteWindowsArgument).join(" ");
  return { command: commandLine, args: [], shell };
}

/**
 * Run the package manager with an argv array, handling the Windows shell rule.
 *
 * @param {string[]} args
 * @param {import("node:child_process").SpawnSyncOptions} [spawnOptions]
 * @returns {import("node:child_process").SpawnSyncReturns<string>}
 */
export function runPackageManager(args, spawnOptions = {}) {
  const {
    command,
    args: finalArgs,
    shell,
  } = buildPackageManagerInvocation({ args });
  return spawnSync(command, finalArgs, { ...spawnOptions, shell });
}
