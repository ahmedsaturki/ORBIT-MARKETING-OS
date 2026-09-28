#!/usr/bin/env node
import { appendFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const markerPath = join(root, "release", "PRODUCTION_RELEASE.json");

function git(args) {
  const env = { ...process.env };
  for (const key of [
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_INDEX_FILE",
    "GIT_COMMON_DIR",
    "GIT_OBJECT_DIRECTORY",
    "GIT_ALTERNATE_OBJECT_DIRECTORIES",
    "GIT_NAMESPACE",
  ]) {
    delete env[key];
  }
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    env,
  }).trim();
}

const marker = JSON.parse(await readFile(markerPath, "utf8"));
if (
  marker?.schemaVersion !== 1 ||
  typeof marker?.releaseId !== "string" ||
  !/^[A-Za-z0-9._-]{1,100}$/.test(marker.releaseId) ||
  marker?.mode !== "EXPLICIT_PRODUCTION_RELEASE"
) {
  throw new Error("Invalid production release marker");
}

const currentSha = git(["rev-parse", "HEAD"]);
const markerCommitSha = git([
  "log",
  "-1",
  "--format=%H",
  "--",
  "release/PRODUCTION_RELEASE.json",
]);

if (!/^[0-9a-f]{40}$/.test(markerCommitSha)) {
  throw new Error("Production release marker has no Git commit");
}

const active = marker.releaseId !== "bootstrap";
const currentRelease = active && markerCommitSha === currentSha;

const lines = [
  `release_id=${marker.releaseId}`,
  `release_sha=${markerCommitSha}`,
  `current_sha=${currentSha}`,
  `release_active=${active}`,
  `release_current=${currentRelease}`,
];

for (const line of lines) console.log(line);

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    lines.map((line) => line + "\n").join(""),
    "utf8",
  );
}
