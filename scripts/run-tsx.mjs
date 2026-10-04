/**
 * Runs a TypeScript entry point through tsx using the current Node binary.
 *
 * Shelling out to `pnpm exec tsx` makes a test depend on the host package
 * manager being launchable as a child process, which fails on Windows hosts
 * where `pnpm.cmd` cannot be spawned. Resolving the tsx CLI and invoking it
 * with process.execPath removes that dependency and the shell.
 *
 * @param {string[]} args - arguments for the TypeScript entry point
 * @param {import("node:child_process").SpawnSyncOptions} [options]
 * @returns {import("node:child_process").SpawnSyncReturns<string>}
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);

/** Absolute path to the tsx CLI entry point. */
export function tsxCli() {
  return require.resolve("tsx/cli");
}

/**
 * Spawn a TypeScript script with tsx.
 *
 * @param {string[]} args - e.g. ["scripts/soak.ts", "--minutes", "1"]
 * @param {import("node:child_process").SpawnSyncOptions} [options]
 */
export function runTsx(args, options = {}) {
  const repoRoot = join(import.meta.dirname, "..");
  return spawnSync(process.execPath, [tsxCli(), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    ...options,
  });
}
