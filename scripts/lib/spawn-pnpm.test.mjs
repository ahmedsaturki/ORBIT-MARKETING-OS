/**
 * Contract for scripts/lib/spawn-pnpm.mjs.
 *
 * The bug this pins: on Windows, `spawnSync("pnpm.cmd", ...)` fails with EINVAL.
 * Since the CVE-2024-27980 fix, Node refuses to execute a `.cmd`/`.bat` target
 * without a shell, so three smoke/evidence scripts died at the spawn before
 * asserting anything. The helper keeps POSIX shell-free and enables the shell
 * only on Windows, and only where every argument is a literal at the call site.
 */
import assert from "node:assert/strict";
import { spawnPnpm } from "./spawn-pnpm.mjs";

const isWindows = process.platform === "win32";

// 1. The helper actually runs the repo's pnpm and reports its version, which is
//    impossible if the spawn returns EINVAL/null status.
{
  const result = spawnPnpm(["--version"]);
  assert.equal(result.error, undefined, "spawnPnpm must not error out");
  assert.equal(result.status, 0, `pnpm --version failed: ${result.stderr}`);
  assert.match(
    (result.stdout ?? "").trim(),
    /^\d+\.\d+\.\d+/u,
    "pnpm --version must print a version",
  );
}

// 2. stdout and stderr are always strings, so a failing child can be surfaced
//    without a typeof guard at the call site.
{
  const result = spawnPnpm(["this-subcommand-does-not-exist"]);
  assert.notEqual(result.status, 0);
  assert.equal(typeof result.stdout, "string");
  assert.equal(typeof result.stderr, "string");
}

// 3. stdin is forwarded, which the MCP surface smoke depends on.
{
  const result = spawnPnpm(["exec", "node", "-e", "process.stdin.resume()"], {
    input: "hello\n",
  });
  assert.equal(result.status, 0);
  assert.equal(typeof result.stdout, "string");
}

// 4. A non-zero child exit is reported, not thrown: the fail-closed assertions
//    in the soak and connector-proof tests read the status themselves.
{
  const result = spawnPnpm(["exec", "node", "-e", "process.exit(3)"]);
  assert.equal(result.status, 3);
}

// 5. Shell use is confined to Windows. On POSIX the child must be the binary
//    itself, so a hostile PATH entry cannot shadow pnpm via command
//    interpretation.
{
  const source = await import("node:fs").then((fs) =>
    fs.readFileSync(new URL("./spawn-pnpm.mjs", import.meta.url), "utf8"),
  );
  const shellAssignments = source.match(/shell:\s*true/gu) ?? [];
  assert.equal(
    shellAssignments.length,
    1,
    "shell:true must appear exactly once, guarded by the platform check",
  );
  assert.ok(
    source.includes("isWindows ? { ...options, shell: true } : options"),
    "the shell branch must be selected by an explicit platform check",
  );
}

console.log(
  `spawn_pnpm_contract=PASS platform=${isWindows ? "win32" : "posix"}`,
);
