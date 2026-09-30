import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  childEnv,
  resolveTool,
  sanitizeOrigin,
  sanitizeText,
} from "./child-env.mjs";

const GIT_OVERRIDE_KEYS = [
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_INDEX_FILE",
  "GIT_COMMON_DIR",
  "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_NAMESPACE",
];

test("resolveTool returns an absolute path to an existing executable", () => {
  const resolved = resolveTool("node");

  assert.equal(resolve(resolved), resolved, "path must be absolute");
  assert.ok(existsSync(resolved), `expected ${resolved} to exist`);
  assert.ok(statSync(resolved).isFile());
  if (process.platform !== "win32") {
    assert.ok((statSync(resolved).mode & 0o111) !== 0, "must be executable");
  }
});

test("resolveTool caches so repeated lookups return the same absolute path", () => {
  assert.equal(resolveTool("node"), resolveTool("node"));
});

test("resolveTool throws a clear error for a binary that does not exist", () => {
  assert.throws(
    () => resolveTool("orbit-definitely-not-a-real-binary-xyz"),
    /Unable to resolve tool "orbit-definitely-not-a-real-binary-xyz"/,
  );
});

test("resolveTool refuses a path that is not an executable file", () => {
  const scriptsDir = dirname(fileURLToPath(import.meta.url));
  assert.throws(
    () => resolveTool(join(scriptsDir, "child-env.test.mjs")),
    /not an executable file/,
  );
});

test("resolveTool honors an explicit absolute path to a real tool", () => {
  const nodePath = resolveTool("node");
  assert.equal(resolveTool(nodePath), nodePath);
});

test("childEnv strips every Git override from the inherited environment", () => {
  const hostile = { ...process.env };
  for (const key of GIT_OVERRIDE_KEYS) hostile[key] = "hostile-value";

  const env = childEnv("node", hostile);

  for (const key of GIT_OVERRIDE_KEYS) {
    assert.equal(
      Object.hasOwn(env, key),
      false,
      `${key} must not reach the child process`,
    );
  }
});

test("childEnv pins PATH to the single directory holding the resolved binary", () => {
  const env = childEnv("node");
  const entries = env.PATH.split(delimiter).filter(Boolean);

  assert.equal(entries.length, 1, `expected one PATH entry, got ${env.PATH}`);
  assert.equal(entries[0], dirname(resolveTool("node")));
  assert.equal(
    entries[0],
    process.platform === "win32"
      ? dirname(process.execPath)
      : dirname(
          execFileSync("sh", ["-c", "command -v node"], {
            encoding: "utf8",
          }).trim(),
        ),
    "the pinned directory must be the one that actually contains the tool",
  );
});

test("childEnv never leaves a second case-variant PATH entry behind", () => {
  const env = childEnv("node", { ...process.env, Path: "attacker\\path" });

  const pathKeys = Object.keys(env).filter(
    (key) => key.toLowerCase() === "path",
  );
  assert.deepEqual(pathKeys, ["PATH"]);
  assert.equal(env.Path, undefined);
});

test("childEnv preserves unrelated environment variables", () => {
  const env = childEnv("node", {
    ...process.env,
    ORBIT_UNRELATED_MARKER: "keep-me",
    ORBIT_BASEENV_ONLY_MARKER: "baseenv-only",
  });

  // Present in both process.env and the passed baseEnv: survives untouched.
  assert.equal(
    env.ORBIT_UNRELATED_MARKER,
    "keep-me",
    "a variable present in process.env must be carried into the child env",
  );
  // Present ONLY in the baseEnv, so it can only survive by being copied from
  // the object that was passed in rather than re-read from process.env.
  assert.equal(
    env.ORBIT_BASEENV_ONLY_MARKER,
    "baseenv-only",
    "a variable supplied only via baseEnv must be copied into the child env",
  );
  // The contract is selective: only PATH and the Git overrides are removed.
  assert.equal(
    env.GIT_DIR,
    undefined,
    "Git overrides must still be stripped while unrelated vars survive",
  );
  assert.notEqual(
    env.PATH,
    process.env.PATH,
    "PATH must still be replaced while unrelated vars survive",
  );
});

test("childEnv does not mutate the environment object it was given", () => {
  const base = { ...process.env, GIT_DIR: "hostile", PATH_MARKER: "untouched" };
  const snapshot = JSON.stringify(base);

  childEnv("node", base);

  assert.equal(JSON.stringify(base), snapshot);
});

test("childEnv gives the child a real, working toolchain", () => {
  // Proves the pinned PATH is still usable by a spawned binary, which is the
  // behaviour the release scripts depend on.
  const nodePath = resolveTool("node");
  const out = execFileSync(
    nodePath,
    ["-e", "process.stdout.write(process.env.PATH)"],
    {
      encoding: "utf8",
      env: childEnv("node"),
    },
  );
  assert.equal(out, dirname(nodePath));
});

test("includeSystemToolchain keeps the tool directory first and adds system dirs", () => {
  const env = childEnv("node", process.env, { includeSystemToolchain: true });
  const entries = env.PATH.split(delimiter).filter(Boolean);

  assert.equal(entries[0], dirname(resolveTool("node")));
  if (process.platform !== "win32") {
    for (const dir of ["/usr/bin", "/bin"]) {
      if (statSync(dir).isDirectory()) {
        assert.ok(
          entries.includes(dir),
          `${dir} must be present for the C toolchain`,
        );
      }
    }
  }
});

test("sanitizeText removes control characters and line separators", () => {
  assert.equal(
    sanitizeText("evil\r\n[INFO] forged line\u0000\u2028tail"),
    "evil[INFO] forged linetail",
  );
});

test("sanitizeOrigin accepts a plain https origin and normalizes it", () => {
  assert.equal(
    sanitizeOrigin("https://orbit-marketing-os.vercel.app"),
    "https://orbit-marketing-os.vercel.app",
  );
  assert.equal(
    sanitizeOrigin("https://orbit.example.com:8443/"),
    "https://orbit.example.com:8443",
  );
});

for (const malicious of [
  "https://orbit.vercel.app\r\n[INFO] forged",
  "https://orbit.vercel.app\n[INFO] forged",
  "https://orbit.vercel.app\u0000\u001b[31mred",
  "https://orbit.vercel.app/sub\npath",
  "https://orbit.vercel.app extra",
  "https://user:pass@orbit.vercel.app",
  "http://orbit.vercel.app",
  "https://localhost",
  "https://.orbit.vercel.app",
  "not-a-url",
  "",
]) {
  test(`sanitizeOrigin rejects poisoned origin: ${JSON.stringify(malicious)}`, () => {
    assert.throws(
      () => sanitizeOrigin(malicious),
      /ORBIT_LIVE_URL/,
      "must fail fast with a clear ORBIT_LIVE_URL error",
    );
  });
}
// Regression: a `g`-flagged regex carries `lastIndex` between calls, so a
// control character located before that offset was never examined and the
// poisoned origin was accepted. These must be two-call sequences in the same
// module instance; isolated single calls always start from lastIndex 0.
for (const [name, poison, attack] of [
  [
    "NUL",
    "https://orbit.vercel.app/sub\u0000evil",
    "\u0000https://orbit.vercel.app",
  ],
  [
    "ESC",
    "https://orbit.vercel.app/sub\u001b[31mred",
    "\u001bhttps://orbit.vercel.app",
  ],
]) {
  test(`sanitizeOrigin rejects a leading ${name} after an earlier match`, () => {
    assert.throws(
      () => sanitizeOrigin(poison),
      /ORBIT_LIVE_URL/,
      "the poisoning call must throw",
    );
    assert.throws(
      () => sanitizeOrigin(attack),
      /ORBIT_LIVE_URL/,
      `a ${name} at index 0 must still be rejected after a prior match`,
    );
  });
}

test("sanitizeOrigin rejects a leading control character as the first call", () => {
  assert.throws(
    () => sanitizeOrigin("\u0000https://orbit.vercel.app"),
    /ORBIT_LIVE_URL/,
    "solo baseline must be unchanged",
  );
});

test("sanitizeOrigin never returns a value containing control characters", () => {
  const accepted = sanitizeOrigin("https://orbit.vercel.app");
  assert.equal(
    /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(accepted),
    false,
    "an accepted origin must be free of control characters",
  );
});

test("the provenance verifier fails fast on a poisoned ORBIT_LIVE_URL", () => {
  const script = fileURLToPath(
    new URL("./verify-public-vercel-provenance.mjs", import.meta.url),
  );

  let stdout = "";
  let failed = false;

  try {
    execFileSync(process.execPath, [script], {
      encoding: "utf8",
      env: {
        ...process.env,
        ORBIT_LIVE_URL:
          "https://orbit.vercel.app\r\n[INFO] production verified",
        ORBIT_EXPECTED_RELEASE_SHA: "a".repeat(40),
      },
    });
  } catch (error) {
    failed = true;
    stdout = String(error.stdout ?? "");
    assert.match(
      String(error.stderr ?? ""),
      /ORBIT_LIVE_URL.*control characters or whitespace/s,
      "must explain why the origin was refused",
    );
  }

  assert.equal(failed, true, "script must exit non-zero on a poisoned origin");
  assert.equal(
    stdout.includes("[INFO] production verified"),
    false,
    "the forged log line must never be emitted",
  );
});
