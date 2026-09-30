import { accessSync, constants, statSync } from "node:fs";
import { delimiter, dirname, isAbsolute, join, resolve } from "node:path";

/**
 * Git environment overrides these release scripts must never inherit.
 * GitHub Actions exports several of them (GIT_DIR, GIT_WORK_TREE, ...),
 * which would otherwise redirect a spawn at a hostile repository.
 */
const GIT_OVERRIDE_KEYS = [
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_INDEX_FILE",
  "GIT_COMMON_DIR",
  "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_NAMESPACE",
];

/**
 * Fixed, OS-owned toolchain directories. Only opted into for tools that
 * genuinely shell out to a C toolchain (cargo -> rustc/cc/linker); on POSIX
 * these are root-owned system paths, never writable by the build user.
 */
const SYSTEM_TOOLCHAIN_DIRS = Object.freeze(
  process.platform === "win32" ? [] : ["/usr/bin", "/bin", "/usr/local/bin"],
);

/** Windows env keys are case-insensitive, so PATH can arrive as `Path`. */
function pathKeyIn(env) {
  for (const key of Object.keys(env)) {
    if (key.toLowerCase() === "path") return key;
  }
  return null;
}

function pathEntries(baseEnv) {
  const key = pathKeyIn(baseEnv);
  return String(key ? baseEnv[key] : "")
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function windowsExtensions() {
  const raw = process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD";
  return raw
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function candidateNames(binary) {
  if (process.platform !== "win32") return [binary];
  return windowsExtensions().map((suffix) =>
    binary.toLowerCase().endsWith(suffix.toLowerCase())
      ? binary
      : binary + suffix,
  );
}

function isExecutableFile(candidate) {
  let stats;
  try {
    stats = statSync(candidate);
  } catch {
    return false;
  }
  if (!stats.isFile()) return false;
  if (process.platform === "win32") {
    // Windows has no executable bit, so require a PATHEXT binary extension;
    // otherwise any data file (a .mjs, a .md) would resolve as a tool.
    const lower = candidate.toLowerCase();
    return windowsExtensions().some((suffix) =>
      lower.endsWith(suffix.toLowerCase()),
    );
  }
  return (stats.mode & 0o111) !== 0;
}

function isDirectory(candidate) {
  try {
    return statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}

function lookup(binary, baseEnv) {
  if (typeof binary !== "string" || binary.trim() === "") {
    throw new Error("resolveTool requires a non-empty binary name");
  }
  const name = binary.trim();

  // An explicit path is honoured only when absolute and executable; it is
  // never searched for.
  if (isAbsolute(name) || name.includes("/") || name.includes("\\")) {
    const absolute = resolve(name);
    if (isExecutableFile(absolute)) return absolute;
    throw new Error(`Tool is not an executable file: ${absolute}`);
  }

  for (const directory of pathEntries(baseEnv)) {
    for (const candidate of candidateNames(name)) {
      const absolute = join(directory, candidate);
      if (isExecutableFile(absolute)) return absolute;
    }
  }

  throw new Error(
    `Unable to resolve tool "${name}" on PATH (${process.platform})`,
  );
}

const cache = new Map();

/**
 * Resolve a binary to an absolute path once, then cache it. Callers spawn the
 * returned absolute path so the command is never re-resolved through PATH.
 */
export function resolveTool(binary, baseEnv = process.env) {
  const key = `${binary} ${pathEntries(baseEnv).join(delimiter)}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const resolved = lookup(binary, baseEnv);
  try {
    accessSync(resolved, constants.X_OK);
  } catch {
    throw new Error(`Resolved tool is not executable: ${resolved}`);
  }
  cache.set(key, resolved);
  return resolved;
}

/**
 * Build a sanitized environment for spawning `binary`.
 *
 * PATH is pinned to fixed, unwriteable directories: the directory holding the
 * resolved binary, plus the OS-owned system toolchain directories when
 * `includeSystemToolchain` is set for a tool that needs a C toolchain.
 */
export function childEnv(binary, baseEnv = process.env, options = {}) {
  const { includeSystemToolchain = false } = options;
  const resolved = resolveTool(binary, baseEnv);

  const env = { ...baseEnv };
  for (const key of GIT_OVERRIDE_KEYS) delete env[key];

  const dirs = [dirname(resolved)];
  if (includeSystemToolchain) {
    for (const dir of SYSTEM_TOOLCHAIN_DIRS) {
      if (dir !== dirs[0] && isDirectory(dir)) dirs.push(dir);
    }
  }

  // Drop every case variant so the child cannot inherit a second, attacker
  // controlled PATH value alongside the pinned one.
  for (const key of Object.keys(env)) {
    if (key !== "PATH" && key.toLowerCase() === "path") delete env[key];
  }
  env.PATH = dirs.join(delimiter);
  return env;
}

// Control characters (including CR/LF) and Unicode line/paragraph separators
// are the log-injection vector for anything echoed into terminal output.
const UNSAFE_TEXT = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/gu;

// Stateless twin for `.test()`. `UNSAFE_TEXT` is `g`-flagged for
// `replaceAll`, and `.test()` on a `g` regex reads AND writes `lastIndex`, so
// reusing it would skip any control character before that offset. This must
// never gain a `g` flag.
const HAS_UNSAFE_TEXT = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u;

/**
 * Strip control characters from remote- or environment-derived text before it
 * reaches a log sink or an error message.
 */
export function sanitizeText(value) {
  return String(value).replaceAll(UNSAFE_TEXT, "");
}

/**
 * Validate an https origin supplied by the environment.
 *
 * Rejects anything that is not a plain https origin: control characters,
 * whitespace, embedded credentials, query/fragment/path components, and
 * malformed hostnames are refused rather than silently stripped.
 */
export function sanitizeOrigin(value, label = "ORBIT_LIVE_URL") {
  const raw = String(value ?? "").trim();
  if (raw === "") {
    throw new Error(`${label} must not be empty`);
  }
  if (HAS_UNSAFE_TEXT.test(raw) || /\s/u.test(raw)) {
    throw new Error(
      `${label} contains control characters or whitespace and is not a valid origin`,
    );
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${label} is not a valid URL: ${sanitizeText(raw)}`);
  }

  if (url.protocol !== "https:") {
    throw new Error(`${label} must use https, received ${url.protocol}`);
  }
  if (url.username || url.password) {
    throw new Error(`${label} must not embed credentials`);
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error(
      `${label} must be a bare origin without a path, query, or fragment`,
    );
  }

  const hostname = url.hostname;
  if (
    hostname.length === 0 ||
    !/^[A-Za-z0-9.-]+$/u.test(hostname) ||
    !hostname.includes(".") ||
    hostname.startsWith(".") ||
    hostname.endsWith(".") ||
    hostname.includes("..")
  ) {
    throw new Error(
      `${label} has an invalid hostname: ${sanitizeText(hostname)}`,
    );
  }

  // Rebuild from validated parts so no unvalidated input is carried forward.
  return `https://${hostname}${url.port ? `:${url.port}` : ""}`;
}
