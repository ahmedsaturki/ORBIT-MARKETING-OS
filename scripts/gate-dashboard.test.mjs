/**
 * Contract for the local gate dashboard's HTTP surface.
 *
 * The regression this exists for: the request handler is async and used to call
 * decodeURIComponent before reaching any try block. A malformed escape such as
 * "/%" made that throw URIError, the rejection was unhandled, and under Node's
 * default behaviour the process exited. One request from anything able to reach
 * the port killed the dashboard. It now answers 404 and stays up.
 *
 * This drives the real server over HTTP rather than importing the resolver,
 * because the failure mode is an unhandled rejection in the request handler,
 * which a unit test of the resolver cannot observe.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function findFreePort() {
  const probe = createServer();
  await new Promise((done, fail) => {
    probe.once("error", fail);
    probe.listen(0, "127.0.0.1", done);
  });
  const { port } = probe.address();
  await new Promise((done) => probe.close(done));
  return port;
}

const port = await findFreePort();
const child = spawn(
  process.execPath,
  [join(repoRoot, "scripts", "gate-dashboard.mjs"), "--port", String(port)],
  { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] },
);

let exited = null;
child.on("exit", (code, signal) => {
  exited = { code, signal };
});

try {
  await Promise.race([
    once(child.stdout, "data"),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("dashboard start timeout")), 20_000),
    ),
  ]);

  const get = async (path) => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`);
    return response.status;
  };

  // A malformed percent escape is a client error, not a server fault.
  assert.equal(await get("/%"), 404, "malformed escape answers 404");
  assert.equal(await get("/%ZZ"), 404, "invalid utf-8 escape answers 404");
  assert.equal(await get("/%E0%A4%A"), 404, "truncated escape answers 404");

  // Traversal outside the repo stays refused.
  assert.equal(
    await get("/../../etc/passwd"),
    404,
    "traversal outside the repo is refused",
  );

  // The dashboard itself still serves.
  assert.equal(await get("/"), 200, "the dashboard is served at the root");

  // And it is still alive after all of the above. Without the guard the process
  // has already exited by this point and every request above would have thrown
  // a connection error instead of returning a status.
  assert.equal(exited, null, "the dashboard process is still running");

  console.log("gate_dashboard_contract=PASS");
} finally {
  if (exited === null) {
    child.kill();
    await once(child, "exit").catch(() => {});
  }
}
