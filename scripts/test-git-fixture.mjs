import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { join } from "node:path";

export const execFileAsync = promisify(execFile);

async function runGit(cwd, args) {
  await execFileAsync("git", args, { cwd });
}

export async function initGitFixture(cwd, marker) {
  await runGit(cwd, ["init", "-q"]);
  await runGit(cwd, [
    "config",
    "user.email",
    "orbit-test@example.invalid",
  ]);
  await runGit(cwd, ["config", "user.name", "ORBIT Test"]);
  await mkdir(join(cwd, "scripts"), { recursive: true });
  await mkdir(join(cwd, "release"), { recursive: true });
  await writeReleaseMarker(
    cwd,
    marker.releaseId ?? "bootstrap",
    marker.notes ?? "",
  );
}

export async function commit(cwd) {
  await runGit(cwd, ["add", "."]);
  await runGit(cwd, ["commit", "-qm", "ORBIT fixture"]);
  return commitSha(cwd);
}

export async function commitSha(cwd) {
  return (
    await execFileAsync("git", ["rev-parse", "HEAD"], { cwd })
  ).stdout.trim();
}

export async function writeReleaseMarker(
  cwd,
  releaseId = "bootstrap",
  notes = "",
) {
  const marker = {
    schemaVersion: 1,
    releaseId,
    mode: "EXPLICIT_PRODUCTION_RELEASE",
  };
  if (notes) marker.notes = notes;
  await writeFile(
    join(cwd, "release", "PRODUCTION_RELEASE.json"),
    JSON.stringify(marker) + "\n",
    "utf8",
  );
}
