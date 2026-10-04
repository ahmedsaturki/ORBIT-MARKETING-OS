import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { join } from "node:path";

export const execFileAsync = promisify(execFile);

// Windows can hold a freshly-used directory open briefly after the child
// process that touched it exits, which surfaces as EBUSY/EPERM on cleanup.
// Retry briefly before giving up so a timing artefact fails as a real error.
export async function removeFixture(cwd) {
  const attempts = 5;
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await rm(cwd, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
    }
  }
  throw lastError;
}

export async function initGitFixture(cwd, marker) {
  await execFileAsync("git", ["init", "-q"], { cwd });
  await execFileAsync(
    "git",
    ["config", "user.email", "orbit-test@example.invalid"],
    { cwd },
  );
  await execFileAsync("git", ["config", "user.name", "ORBIT Test"], { cwd });
  await mkdir(join(cwd, "scripts"), { recursive: true });
  await mkdir(join(cwd, "release"), { recursive: true });
  await writeReleaseMarker(
    cwd,
    marker.releaseId ?? "bootstrap",
    marker.notes ?? "",
  );
}

export async function commit(cwd) {
  await execFileAsync("git", ["add", "."], { cwd });
  await execFileAsync("git", ["commit", "-qm", "ORBIT fixture"], { cwd });
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
