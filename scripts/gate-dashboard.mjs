#!/usr/bin/env node
/**
 * Serves the release gate dashboard together with release/readiness.json and
 * the shared gate model it imports. The dashboard needs all three from one
 * origin, so this avoids an external `serve` dependency.
 *
 * Usage: node scripts/gate-dashboard.mjs [--port 8080] [--readiness FILE]
 */

import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : fallback;
};

const port = Number(flag("--port", process.env.PORT ?? "8080"));
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`invalid port: ${flag("--port", "")}`);
  process.exit(1);
}

const readinessPath = resolve(
  process.cwd(),
  flag("--readiness", join(repoRoot, "release", "readiness.json")),
);
if (!existsSync(readinessPath)) {
  console.error(`readiness file not found: ${readinessPath}`);
  process.exit(1);
}

/**
 * The dashboard is served at "/", so its relative imports and fetches resolve
 * against the repo root rather than scripts/. These aliases bridge that gap
 * without duplicating files.
 */
const ALIASES = new Map([
  ["/release/readiness.json", readinessPath],
  [
    "/release-gate-model.mjs",
    join(repoRoot, "scripts", "release-gate-model.mjs"),
  ],
]);

const isInsideRepo = (target) =>
  target === repoRoot || target.startsWith(repoRoot + sep);

/** Resolve a request path to a servable file, rejecting traversal outside the repo. */
function resolveTarget(requestUrl) {
  const requestPath = decodeURIComponent((requestUrl ?? "/").split("?")[0]);

  if (requestPath === "/") {
    return join(repoRoot, "scripts", "gate-status-dashboard.html");
  }

  const alias = ALIASES.get(requestPath);
  if (alias) {
    return alias;
  }

  const target = normalize(join(repoRoot, requestPath.replace(/^\/+/, "")));
  return isInsideRepo(target) ? target : null;
}

const contentTypeFor = (target) => {
  if (target.endsWith(".mjs") || target.endsWith(".js")) {
    return "text/javascript; charset=utf-8";
  }
  if (target.endsWith(".json")) {
    return "application/json; charset=utf-8";
  }
  return "text/html; charset=utf-8";
};

const server = createServer(async (req, res) => {
  const target = resolveTarget(req.url);

  if (!target || !existsSync(target)) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("not found");
    return;
  }

  let body;
  try {
    body = await readFile(target);
  } catch {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end("internal server error");
    return;
  }

  res.writeHead(200, {
    "content-type": contentTypeFor(target),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(body);
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(
    `ORBIT gate dashboard listening on http://127.0.0.1:${port}\n`,
  );
  process.stdout.write(`serving readiness from ${readinessPath}\n`);
});
