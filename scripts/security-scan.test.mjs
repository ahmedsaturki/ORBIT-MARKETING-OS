/**
 * Behavioral contract for scripts/security-scan.mjs (the `security:scan`
 * supply-chain control).
 *
 * The scanner takes no CLI arguments: it resolves its own repository root from
 * import.meta.url and inspects whatever `git ls-files` reports there. To
 * exercise it end-to-end without touching the real working tree, each case
 * builds a throwaway git repository in the OS temp directory and copies the
 * real scanner source into it at test time. The copy is made per case, so a
 * mutation of the shipped script is what the assertions run against.
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = resolve(dirname(fileURLToPath(import.meta.url)));

// The scanner shells out to `git`, so it needs the caller's PATH. Resolving it
// through `git` on PATH keeps this test independent of the scanner's own env
// helper, so the contract can be verified against a clean checkout.
const git = "git";
const gitEnv = { ...process.env };

/** A syntactically valid, deliberately meaningless token fixture. */
const FAKE_GITHUB_TOKEN = "ghp_" + "A".repeat(36);

function runScanner(repoDir) {
  const result = spawnSync(
    process.execPath,
    [join(repoDir, "scripts", "security-scan.mjs")],
    {
      cwd: repoDir,
      encoding: "utf8",
      env: { ...process.env },
    },
  );
  assert.equal(
    result.signal,
    null,
    "scanner must exit on its own rather than being killed by a signal",
  );
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

const fixtureDirs = [];

/**
 * Build a throwaway repository whose scripts/ dir is the shipped scanner, and
 * whose tracked files are exactly `files`.
 */
function createFixtureRepo(name, files) {
  const repoDir = mkdtempSync(join(tmpdir(), name));
  // Register before any further setup so a failure part-way through still gets
  // cleaned up by the finally block rather than orphaning a temp directory.
  fixtureDirs.push(repoDir);
  mkdirSync(join(repoDir, "scripts"), { recursive: true });
  copyFileSync(
    join(scriptsDir, "security-scan.mjs"),
    join(repoDir, "scripts", "security-scan.mjs"),
  );
  for (const [relativePath, content] of Object.entries(files)) {
    const target = join(repoDir, relativePath);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content, "utf8");
  }
  const run = (args) =>
    execFileSync(git, args, {
      cwd: repoDir,
      encoding: "utf8",
      env: gitEnv,
      stdio: ["ignore", "pipe", "pipe"],
    });
  run(["init", "--quiet"]);
  run(["add", "--all", "."]);
  return repoDir;
}

// createFixtureRepo registers the directory for cleanup itself, so this is
// just a readability alias at the call sites.
function fixture(name, files) {
  return createFixtureRepo(name, files);
}

try {
  // 1. Clean repository: exit 0 and report a machine-readable pass summary.
  {
    const repoDir = fixture("orbit-security-scan-clean-", {
      "README.md": "# fixture\n\nNo credentials here.\n",
      "config.json": JSON.stringify({ name: "fixture" }),
    });

    const result = runScanner(repoDir);
    assert.equal(
      result.status,
      0,
      "a repository without secrets must scan clean",
    );
    assert.equal(result.stderr, "", "a passing scan must not write to stderr");

    const summary = JSON.parse(result.stdout);
    assert.equal(summary.status, "passed");
    // The fixture is fully controlled: the scanner itself plus the two files
    // this case declares, so these counts are exact and not environment-bound.
    assert.equal(
      summary.trackedFiles,
      3,
      "summary must count every tracked file, including the scanner itself",
    );
    assert.equal(summary.checkedTextFiles, 3);
  }

  // 2. Embedded credential in a tracked text file: exit 1, named on stderr.
  {
    const repoDir = fixture("orbit-security-scan-token-", {
      "src/config.js": `export const token = "${FAKE_GITHUB_TOKEN}";\n`,
    });

    const result = runScanner(repoDir);
    assert.equal(
      result.status,
      1,
      "an embedded GitHub token must fail the scan instead of passing",
    );
    assert.match(result.stderr, /ORBIT secret scan failed:/u);
    assert.match(
      result.stderr,
      /src\/config\.js: possible embedded credential\/token pattern/u,
    );
    assert.equal(
      result.stdout,
      "",
      "a failing scan must not print a pass summary",
    );
  }

  // 3. A tracked, non-example environment file is treated as a secret file.
  {
    const repoDir = fixture("orbit-security-scan-env-", {
      ".env": "DATABASE_URL=postgres://user:password@localhost:5432/orbit\n",
    });

    const result = runScanner(repoDir);
    assert.equal(
      result.status,
      1,
      "a tracked .env file that is not an approved example must fail the scan",
    );
    assert.match(
      result.stderr,
      /\.env: tracked environment file is not an approved example/u,
    );
  }

  // 4. .env.example stays allowed, so the example template is not a finding.
  {
    const repoDir = fixture("orbit-security-scan-env-example-", {
      ".env.example":
        "DATABASE_URL=postgres://user:password@localhost:5432/orbit\n",
    });

    const result = runScanner(repoDir);
    assert.equal(
      result.status,
      0,
      ".env.example is an approved example file and must not fail the scan",
    );
    assert.equal(JSON.parse(result.stdout).status, "passed");
  }

  // 5. Private-key material in a tracked text file: exit 1.
  {
    // Assembled at runtime so this test file does not itself contain a literal
    // PEM header, which the scanner it exercises is designed to flag.
    const pemHeader = `${"-".repeat(5)}BEGIN RSA PRIVATE KEY${"-".repeat(5)}`;
    const repoDir = fixture("orbit-security-scan-pem-", {
      "docs/setup.md": `${pemHeader}\nnot-a-real-key\n`,
    });

    const result = runScanner(repoDir);
    assert.equal(result.status, 1, "XX");
    assert.match(
      result.stderr,
      /docs\/setup\.md: possible embedded credential\/token pattern/u,
    );
  }

  console.log("security_scan_contract=PASS");
} finally {
  for (const dir of fixtureDirs) rmSync(dir, { recursive: true, force: true });
}
