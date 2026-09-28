import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { join } from "node:path";

export const execFileAsync = promisify(execFile);

export async function git(cwd, args) {
  await execFileAsync("git", args, { cwd });
}

export async function commitSha(cwd) {
  return (
    await execFileAsync("git", ["rev-parse", "HEAD"], { cwd })
  ).stdout.trim();
}

export async function initGitFixture(cwd, marker) {
  await git(cwd, ["init", "-q"]);
  await git(cwd, ["config", "user.email", "orbit-test@example.invalid"]);
  await git(cwd, ["config", "user.name", "ORBIT Test"]);
  await mkdir(join(cwd, "scripts"), { recursive: true });
  await mkdir(join(cwd, "release"), { recursive: true });
  await writeFile(
    join(cwd, "release", "PRODUCTION_RELEASE.json"),
    JSON.stringify(marker) + "\n",
    "utf8",
  );
}
