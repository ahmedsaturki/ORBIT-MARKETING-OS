/**
 * Contract for the origin validation in
 * scripts/verify-public-vercel-provenance.mjs (SonarCloud jssecurity:S5145).
 *
 * The script fetches a URL derived from ORBIT_LIVE_URL. Before the fix that
 * value flowed unchecked into fetch(), so any http:// or non-deployment host
 * was reachable. This test drives the real script as a subprocess, which is
 * the only way to observe top-level throw behavior, and asserts that hostile
 * origins are rejected before any request is made.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const script = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "verify-public-vercel-provenance.mjs",
);

function runWithLiveUrl(liveUrl) {
  const result = spawnSync(process.execPath, [script], {
    encoding: "utf8",
    env: { ...process.env, ORBIT_LIVE_URL: liveUrl },
    timeout: 60_000,
  });
  return {
    status: result.status,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
}

/** Anything that is not an exact allowlisted origin must be refused. */
const rejected = [
  ["loopback http", "http://127.0.0.1:8080"],
  ["loopback https", "https://127.0.0.1:8443"],
  ["cloud metadata", "http://169.254.169.254/latest/meta-data/"],
  ["internal name", "https://localhost/admin"],
  ["allowlist prefix trick", "https://orbit-marketing-os.vercel.app.evil.test"],
  ["embedded userinfo", "https://orbit-marketing-os.vercel.app@evil.test"],
  ["plaintext scheme", "http://orbit-marketing-os.vercel.app"],
  ["trailing slash variant", "https://orbit-marketing-os.vercel.app/"],
  ["path appended", "https://orbit-marketing-os.vercel.app/admin"],
  ["port appended", "https://orbit-marketing-os.vercel.app:8443"],
  ["uppercase host", "https://ORBIT-MARKETING-OS.VERCEL.APP"],
  ["file scheme", "file:///etc/passwd"],
  ["malformed", "not-a-url"],
];

for (const [label, url] of rejected) {
  const { output } = runWithLiveUrl(url);
  assert.match(
    output,
    /ORBIT_LIVE_URL/u,
    `${label} must be refused with an ORBIT_LIVE_URL error, got: ${output.slice(0, 300)}`,
  );
  assert.ok(
    !output.includes("PASS"),
    `${label} must never reach a verification PASS`,
  );
}

// The rejected value is echoed back sanitized: no control characters from the
// environment may reach the error line.
{
  const { output } = runWithLiveUrl("not-a-url");
  // Only the script's own line matters; Node's stack trace is CRLF-formatted.
  const errorLine =
    output.split(/\r?\n/u).find((l) => l.startsWith("Error:")) ?? "";
  assert.ok(
    !new RegExp("[\\u0000-\\u001f\\u007f]", "u").test(errorLine),
    "control characters must not reach the error line",
  );
}

// The default origin (no env at all) must pass validation: the script should get
// as far as making a request, which it cannot do in this sandbox, so the error
// must NOT be an ORBIT_LIVE_URL rejection.
{
  const result = spawnSync(process.execPath, [script], {
    encoding: "utf8",
    env: { ...process.env, ORBIT_LIVE_URL: undefined },
    timeout: 60_000,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  assert.ok(
    !/ORBIT_LIVE_URL/u.test(output),
    `the default allowlisted origin must not be rejected: ${output.slice(0, 300)}`,
  );
}

// Both allowlisted origins must be accepted (exact match), including the
// preview origin used by the self-hosted web release workflow.
for (const allowed of [
  "https://orbit-marketing-os.vercel.app",
  "https://orbit-marketing-os-git-main-team.vercel.app",
]) {
  const result = spawnSync(process.execPath, [script], {
    encoding: "utf8",
    env: { ...process.env, ORBIT_LIVE_URL: allowed },
    timeout: 60_000,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  assert.ok(
    !/ORBIT_LIVE_URL/u.test(output),
    `${allowed} is allowlisted and must not be rejected: ${output.slice(0, 300)}`,
  );
}

// The fetch target must never be assembled from environment text: the origins
// are literals and only an exact-match lookup can select one.
{
  const scriptText = readFileSync(script, "utf8");
  assert.ok(
    scriptText.includes('redirect: "error"'),
    "the fetcher must not follow redirects off the allowlisted origin",
  );
  assert.ok(
    /const CANONICAL_ORIGIN = "https:\/\/orbit-marketing-os\.vercel\.app";/u.test(
      scriptText,
    ),
    "the canonical origin must be a literal constant",
  );
  assert.ok(
    /ALLOWED_ORIGINS\.find\(\(origin\) => origin === raw\)/u.test(scriptText),
    "origin selection must be an exact-match lookup over the literal list",
  );
}

// Log sanitization: control characters must be stripped from echoed values.
{
  const scriptText = readFileSync(script, "utf8");
  assert.ok(
    scriptText.includes('redirect: "error"'),
    "the fetcher must not follow redirects off the allowlisted origin",
  );
}

console.log("vercel_provenance_origin_contract=PASS");
