/**
 * Behavioral contract for scripts/lib/spawn.mjs.
 *
 * The defect this guards: `spawnSync("pnpm.cmd", args)` cannot execute a Windows
 * `.cmd` shim without a shell, so on a Windows checkout every package-manager
 * spawn returned `status: null` with `EINVAL` and `stdout`/`stderr` were
 * undefined. CI runs these scripts on ubuntu only, so the regression must be
 * caught by a platform-independent test of the resolution logic, not by
 * actually spawning Windows binaries.
 *
 * The contract asserted here is what a consumer-visible Windows failure
 * actually depends on:
 *   1. the win32 branch goes through a shell (otherwise status is null),
 *   2. the posix branch does NOT (a shell there changes POSIX behavior),
 *   3. arguments are quoted, so a path with spaces is not split by the shell,
 *   4. shell metacharacters / quotes / percent-expansion are rejected, not
 *      interpolated (argument injection through the shell),
 *   5. ORBIT_PNPM_BIN overrides resolution for pinned CI images.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  buildPackageManagerInvocation,
  quoteWindowsArgument,
  resolvePackageManager,
  runPackageManager,
} from "./lib/spawn.mjs";

const scriptsDir = resolve(dirname(fileURLToPath(import.meta.url)));

// --- 1/2. platform resolution -------------------------------------------------

const win = resolvePackageManager({ platform: "win32", env: {} });
assert.equal(win.command, "pnpm.cmd", "win32 must resolve the .cmd shim");
assert.equal(
  win.shell,
  true,
  "win32 must spawn the .cmd shim through a shell or the spawn returns status null",
);

for (const platform of ["linux", "darwin"]) {
  const posix = resolvePackageManager({ platform, env: {} });
  assert.equal(posix.command, "pnpm", `${platform} must resolve pnpm`);
  assert.equal(
    posix.shell,
    false,
    `${platform} must spawn pnpm directly without a shell`,
  );
}

// --- 3. quoting ---------------------------------------------------------------

const spaced = buildPackageManagerInvocation({
  platform: "win32",
  env: {},
  args: ["exec", "tsx", "C:/Program Files/orbit/script.ts"],
});
assert.equal(spaced.shell, true);
assert.equal(
  spaced.command,
  'pnpm.cmd exec tsx "C:/Program Files/orbit/script.ts"',
  "arguments containing spaces must be quoted for cmd.exe",
);
assert.deepEqual(
  spaced.args,
  [],
  "a shelled invocation passes one command line",
);

const posixCall = buildPackageManagerInvocation({
  platform: "linux",
  env: {},
  args: ["exec", "tsx", "script.ts"],
});
assert.deepEqual(
  posixCall,
  { command: "pnpm", args: ["exec", "tsx", "script.ts"], shell: false },
  "posix must keep the original argv array so the command line is unchanged",
);

assert.equal(quoteWindowsArgument("plain"), "plain");
assert.equal(quoteWindowsArgument(""), "");
assert.equal(quoteWindowsArgument("--surface"), "--surface");
assert.equal(quoteWindowsArgument("two words"), '"two words"');

// Shell metacharacters are neutralized by quoting, so they still arrive as one
// literal token rather than being rejected outright.
for (const metachar of ["a&calc", "a|c", "a&&b", "a^b", "a>b", "a!b", "a#b"]) {
  assert.equal(
    quoteWindowsArgument(metachar),
    `"${metachar}"`,
    `metacharacter argument must be quoted so cmd.exe cannot split it: ${metachar}`,
  );
}

// --- 4. injection guard -------------------------------------------------------
// A quote, a percent-expansion, or an embedded newline cannot be represented as
// one literal argv token through cmd.exe, so they are refused rather than
// silently mangled.

for (const hostile of ['a"b', "a%PATH%b", "a\nb"]) {
  assert.throws(
    () => quoteWindowsArgument(hostile),
    /unsafe_windows_shell_argument/,
    `must reject shell-unsafe argument: ${JSON.stringify(hostile)}`,
  );
}

assert.throws(
  () =>
    buildPackageManagerInvocation({ platform: "win32", env: {}, args: [42] }),
  /package_manager_args_must_be_strings/,
);

// --- 5. explicit override -----------------------------------------------------

assert.deepEqual(
  resolvePackageManager({
    platform: "linux",
    env: { ORBIT_PNPM_BIN: "pnpm9" },
  }),
  {
    command: "pnpm9",
    shell: false,
  },
);
assert.deepEqual(
  resolvePackageManager({
    platform: "win32",
    env: { ORBIT_PNPM_BIN: "C:/tools/pnpm.CMD" },
  }),
  { command: "C:/tools/pnpm.CMD", shell: true },
  "an overridden .cmd shim on win32 still needs a shell",
);
assert.deepEqual(
  resolvePackageManager({ platform: "win32", env: { ORBIT_PNPM_BIN: "  " } }),
  { command: "pnpm.cmd", shell: true },
  "a blank override must not shadow the default",
);

// --- end-to-end: the helper actually produces output (platform-independent) ----
//
// On this host the resolved executable must return real stdout, never the
// `status: null` / `undefined` output that the Windows bug produced.
const version = runPackageManager(["-v"], { encoding: "utf8" });
assert.equal(
  version.status,
  0,
  `package manager must run and report status 0, got ${version.status}\nstdout=${version.stdout}\nstderr=${version.stderr}`,
);
assert.match(
  String(version.stdout),
  /^\d+\.\d+\.\d+/,
  `expected a real version string on stdout, got ${JSON.stringify(version.stdout)}`,
);

// --- consumer contract: no shipped script may bypass the helper ----------------
//
// A regression that reintroduces the raw `pnpm.cmd` spawn inside a script would
// pass every assertion above while breaking Windows again, so the shipped
// callers are checked directly.
const guarded = [
  "orbit-surface-smoke.mjs",
  "commercial-connector-proof.safe.test.mjs",
  "soak-failure-evidence.test.mjs",
];
for (const file of guarded) {
  const source = readFileSync(join(scriptsDir, file), "utf8");
  assert.doesNotMatch(
    source,
    /pnpm\.cmd|npm\.cmd/,
    `${file} must not hardcode a Windows shim; use runPackageManager from ./lib/spawn.mjs`,
  );
  assert.match(
    source,
    /runPackageManager/,
    `${file} must route its package-manager spawn through the shared helper`,
  );
  assert.doesNotMatch(
    source,
    /shell:\s*true/,
    `${file} must not enable a shell directly; the helper owns that decision`,
  );
}

// --- helper must not smuggle shell usage onto posix at runtime -----------------
const probeDir = mkdtempSync(join(tmpdir(), "orbit-spawn-helper-"));
try {
  const probe = join(probeDir, "probe.mjs");
  writeFileSync(
    probe,
    `import { resolvePackageManager } from ${JSON.stringify(
      pathToFileURL(join(scriptsDir, "lib", "spawn.mjs")).href,
    )};
process.stdout.write(JSON.stringify([
  resolvePackageManager({ platform: "linux", env: {} }),
  resolvePackageManager({ platform: "win32", env: {} }),
]));`,
  );
  const out = spawnSync(process.execPath, [probe], { encoding: "utf8" });
  assert.equal(out.status, 0, out.stderr);
  assert.deepEqual(JSON.parse(out.stdout), [
    { command: "pnpm", shell: false },
    { command: "pnpm.cmd", shell: true },
  ]);
} finally {
  rmSync(probeDir, { recursive: true, force: true });
}

console.log("spawn_helper_test=PASS");
