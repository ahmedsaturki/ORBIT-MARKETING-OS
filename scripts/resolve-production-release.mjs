#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { execFileTracked } from "./lib/exec.mjs";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const markerPath = join(root, "release", "PRODUCTION_RELEASE.json");

function gitRevParseHead() {
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
  return execFileTracked("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
    env,
  }).trim();
}

function gitMarkerCommit() {
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
  return execFileTracked("git", ["log", "-1", "--format=%H", "--", markerPath], {
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

const currentSha = gitRevParseHead();
const markerCommitSha = gitMarkerCommit();

if (!/^[0-9a-f]{40}$/i.test(currentSha)) {
  throw new Error("Current Git revision is not a full SHA");
}
if (!/^[0-9a-f]{40}$/i.test(markerCommitSha)) {
  throw new Error("Production release marker has no full Git SHA");
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
