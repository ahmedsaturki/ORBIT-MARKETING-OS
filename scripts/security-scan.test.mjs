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

/**
 * Build a throwaway repository whose scripts/ dir is the shipped scanner, and
 * whose tracked files are exactly `files`.
 */
function createFixtureRepo(name, files) {
  const repoDir = mkdtempSync(join(tmpdir(), name));
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

const fixtureDirs = [];
function fixture(name, files) {
  const dir = createFixtureRepo(name, files);
  fixtureDirs.push(dir);
  return dir;
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
    // The scanner and the two fixture files are always tracked; the scanner may
    // pull in extra local helpers, so assert the floor rather than an exact
    // count that would differ between a clean checkout and a dirty tree.
    assert.ok(
      summary.trackedFiles >= 3,
      "summary must count the tracked files, including the scanner itself",
    );
    assert.ok(
      summary.checkedTextFiles >= 3,
      "summary must report the text files it inspected",
    );
    assert.ok(
      summary.checkedTextFiles <= summary.trackedFiles,
      "inspected text files cannot exceed tracked files",
    );
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
    const repoDir = fixture("orbit-security-scan-pem-", {
      "docs/setup.md": "-----BEGIN RSA PRIVATE KEY-----\nnot-a-real-key\n",
    });

    const result = runScanner(repoDir);
    assert.equal(
      result.status,
      1,
      "private-key material in a tracked text file must fail the scan",
    );
    assert.match(
      result.stderr,
      /docs\/setup\.md: possible embedded credential\/token pattern/u,
    );
  }

  console.log("security_scan_contract=PASS");
} finally {
  for (const dir of fixtureDirs) rmSync(dir, { recursive: true, force: true });
}
