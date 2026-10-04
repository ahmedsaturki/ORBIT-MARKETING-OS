#!/usr/bin/env node
/**
 * Parses every Playwright spec under e2e/ and fails on a real syntax or binding
 * error.
 *
 * Why this exists: `pnpm typecheck` runs `turbo run typecheck`, which only
 * visits workspace packages. `e2e/` is not a workspace package and has no
 * tsconfig.json, so nothing checked the specs. A duplicate `const` in
 * e2e/tauri-shell.spec.ts reached CI and failed the Web E2E step only after a
 * full push, install, build and browser install, reported by Playwright as a
 * runtime SyntaxError rather than as a type or lint failure.
 *
 * Implementation notes, because the obvious approaches do not work here:
 *
 * - `node --check` and TypeScript's `parseDiagnostics` both report a duplicate
 *   `const` as clean. Redeclaration is a binding error, not a parse error, so
 *   neither sees it. Both were verified against a spec carrying two adjacent
 *   `const missionWorkspace` declarations and both passed it.
 * - `tsc --noResolve` is required, otherwise the compiler follows the spec's
 *   imports into Playwright and the app and reports unresolved-module noise.
 *   Those diagnostics (TS2307 cannot find module, TS7006/TS7031 implicit any
 *   from an unresolved import, TS2591) are filtered out. What remains are
 *   genuine binding and syntax errors, which is what this gate is for.
 *
 * The compiler is resolved through the workspace rather than the repository
 * root because pnpm's strict layout does not hoist typescript to the root.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const specDir = join(repoRoot, "e2e");

function collectSpecs(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...collectSpecs(full));
    } else if (entry.endsWith(".spec.ts")) {
      found.push(full);
    }
  }
  // Explicit comparator: the default sort is lexicographic, which orders
  // uppercase before lowercase and would report specs in an order that does
  // not match the filesystem listing.
  return found.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

// Under pnpm the compiler is only linked into workspace packages, never at the
// repository root, so resolve it through a package rather than guessing a path.
// Resolution must not depend on which packages happen to be installed, so this
// walks every workspace package instead of probing a fixed list.
function findTsc() {
  const direct = join(repoRoot, "node_modules", "typescript", "bin", "tsc");
  if (existsSync(direct)) return direct;
  const packagesDir = join(repoRoot, "packages");
  if (!existsSync(packagesDir)) return null;
  for (const pkg of readdirSync(packagesDir)) {
    const candidate = join(
      packagesDir,
      pkg,
      "node_modules",
      "typescript",
      "bin",
      "tsc",
    );
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const tscBin = findTsc();
if (!tscBin) {
  console.error(
    "verify-e2e-parses: could not locate the TypeScript compiler under any " +
      "workspace package. This gate needs `pnpm install` to have run.",
  );
  process.exit(1);
}

const specs = collectSpecs(specDir);
if (specs.length === 0) {
  console.error(`verify-e2e-parses: no specs found under ${specDir}`);
  process.exit(1);
}

// Diagnostics that only appear because --noResolve stopped the compiler from
// following imports. Everything else is a real error in the spec itself.
const RESOLVE_NOISE = new Set([
  "TS2307", // cannot find module
  "TS2591", // cannot find name 'require'/'process' without node types
  "TS7006", // implicitly has an 'any' type (parameter of unresolved import)
  "TS7016", // implicitly has an 'any' type (untyped module)
  "TS7031", // binding element implicitly any (unresolved destructuring)
  "TS2688", // cannot find type definition file
]);

const result = spawnSync(
  process.execPath,
  [
    tscBin,
    "--ignoreConfig",
    "--noEmit",
    "--skipLibCheck",
    "--noResolve",
    "--target",
    "es2022",
    "--module",
    "esnext",
    "--moduleResolution",
    "bundler",
    ...specs.map((spec) => relative(repoRoot, spec)),
  ],
  { cwd: repoRoot, encoding: "utf8" },
);

const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
const real = [];
for (const line of output.split(/\r?\n/)) {
  const match = /error (TS\d+):/.exec(line);
  if (!match || RESOLVE_NOISE.has(match[1])) continue;
  real.push(line.trim());
}

if (real.length > 0) {
  for (const line of real) console.error(`  ${line}`);
  console.error(
    `verify-e2e-parses: ${real.length} real error(s) in ${specs.length} spec(s)`,
  );
  process.exit(1);
}

console.log(`e2e-parses=PASS specs=${specs.length}`);
