import { spawnSync } from "node:child_process";

/**
 * Cross-platform spawn for the repo's own pnpm.
 *
 * On Windows, `spawnSync("pnpm.cmd", ...)` fails with EINVAL: since the
 * CVE-2024-27980 fix, Node refuses to run a `.cmd`/`.bat` target unless the
 * child is started through a shell, precisely so an argument can never be
 * interpreted as a shell construct. Shell execution is therefore only safe
 * here because every argument passed to this helper is a literal from the
 * call site — no caller interpolates user input, paths, or secrets.
 *
 * POSIX has no such restriction: `pnpm` is executed directly, with no shell.
 */
export function spawnPnpm(args = [], options = {}) {
  const isWindows = process.platform === "win32";
  const command = isWindows ? "pnpm.cmd" : "pnpm";
  const shellOptions = isWindows ? { ...options, shell: true } : options;
  return spawnSync(command, args, { encoding: "utf8", ...shellOptions });
}
