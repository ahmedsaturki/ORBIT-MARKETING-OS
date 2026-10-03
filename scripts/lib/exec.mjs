import { spawn, execFileSync } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, sep } from "node:path";

/**
 * Fail-closed resolution of executables by absolute path (SonarCloud
 * javascript:S4036). Spawning a bare command name resolves through PATH,
 * whose entries may be attacker-writable. This helper only accepts an
 * executable that lives in a fixed allowlist of trusted, absolute
 * directories; anything else throws UntrustedExecutableError. It never
 * falls back to a PATH lookup.
 */
export class UntrustedExecutableError extends Error {
  constructor(command, searched) {
    super(
      `Refusing to execute "${command}": not found in a trusted location (searched ${searched
        .map((dir) => `"${dir}"`)
        .join(", ")}). UntrustedExecutableError`,
    );
    this.name = "UntrustedExecutableError";
  }
}

function existsExecutable(candidate) {
  try {
    accessSync(candidate, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function assertBareName(command) {
  if (typeof command !== "string" || command.length === 0) {
    throw new UntrustedExecutableError(String(command), []);
  }
  if (isAbsolute(command) || command.includes(sep) || command.includes("/") || command.includes("\\")) {
    throw new UntrustedExecutableError(command, []);
  }
}

/** Trusted directories on POSIX. Only system-owned bins plus the rustup/cargo shims. */
function posixTrustedDirs() {
  return [
    "/usr/bin",
    "/bin",
    "/usr/local/bin",
    // rustup-installed cargo toolchain shim (GitHub runners and rust docker images).
    join(homedir(), ".cargo", "bin"),
    "/usr/local/cargo/bin",
  ];
}

function gitCmdDirCandidates() {
  const candidates = [];
  const gitExecPath = process.env.GIT_EXEC_PATH;
  if (gitExecPath) {
    // <gitRoot>/(libexec/|lib/)git-core → gitRoot
    const gitRoot = dirname(dirname(gitExecPath));
    candidates.push(join(gitRoot, "cmd"), join(gitRoot, "bin"));
  }
  for (const base of [
    process.env.ProgramFiles,
    process.env["ProgramFiles(x86)"],
    process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "Programs") : undefined,
  ]) {
    if (base) candidates.push(join(base, "Git", "cmd"));
  }
  return candidates.filter((dir) => existsExecutable(dir));
}

/** Trusted directories on Windows: System32, Git for Windows, rustup cargo shim. */
function windowsTrustedDirs() {
  const systemRoot = process.env.SystemRoot ?? "C:\\Windows";
  return [
    join(systemRoot, "System32"),
    ...gitCmdDirCandidates(),
    join(homedir(), ".cargo", "bin"),
  ];
}

/**
 * Resolve `command` (a bare executable name) to a trusted absolute path.
 * Throws UntrustedExecutableError when no trusted candidate exists.
 */
export function resolveTrustedExecutable(command) {
  assertBareName(command);
  if (process.platform === "win32") {
    const names = /\.(?:exe|cmd|bat|com)$/iu.test(command)
      ? [command]
      : [command + ".exe", command + ".cmd", command + ".bat", command + ".com"];
    const dirs = windowsTrustedDirs();
    for (const dir of dirs) {
      for (const name of names) {
        const candidate = join(dir, name);
        if (existsExecutable(candidate)) return candidate;
      }
    }
    throw new UntrustedExecutableError(command, dirs);
  }
  const dirs = posixTrustedDirs();
  for (const dir of dirs) {
    const candidate = join(dir, command);
    if (existsExecutable(candidate)) return candidate;
  }
  throw new UntrustedExecutableError(command, dirs);
}

/**
 * Like child_process.execFileSync, but the command is resolved to a trusted
 * absolute path first. Never resolves through PATH.
 */
export function execFileTracked(command, args = [], options = {}) {
  // execFileSync/pdfamily only honors PATH for resolution; once the command
  // is absolute the lookup is bypassed entirely.
  return execFileSync(resolveTrustedExecutable(command), args, options);
}

/**
 * Like child_process.spawn, but the command is resolved to a trusted absolute
 * path first. Never resolves through PATH.
 */
export function spawnTracked(command, args = [], options = {}) {
  return spawn(resolveTrustedExecutable(command), args, options);
}
