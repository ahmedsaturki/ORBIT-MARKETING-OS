import { execFileSync, spawnSync } from "node:child_process";
import { statSync, existsSync } from "node:fs";

const required = [
  "pnpm-lock.yaml",
  "packages/desktop/src-tauri/Cargo.lock",
];

for (const path of required) {
  if (!existsSync(path) || !statSync(path).isFile() || statSync(path).size === 0) {
    throw new Error("Missing or empty lockfile: " + path);
  }
}

const branch = process.env.GITHUB_REF_NAME;
if (branch !== "rebuild/orbit-production") {
  throw new Error("Lockfile bootstrap may only push rebuild/orbit-production; got " + (branch ?? "unknown"));
}

execFileSync("git", ["config", "user.name", "ORBIT Automation"], { stdio: "inherit" });
execFileSync(
  "git",
  ["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"],
  { stdio: "inherit" },
);
execFileSync("git", ["add", ...required], { stdio: "inherit" });

const stagedDiff = spawnSync("git", ["diff", "--cached", "--quiet"], {
  stdio: "inherit",
});
if (stagedDiff.error) throw stagedDiff.error;
if (stagedDiff.status === 0) {
  console.log("Lockfiles already current.");
  process.exit(0);
}
if (stagedDiff.status !== 1) {
  throw new Error("git diff --cached --quiet failed with status " + stagedDiff.status);
}

execFileSync("git", ["commit", "-m", "chore(ci): bootstrap reproducible lockfiles"], {
  stdio: "inherit",
});
execFileSync("git", ["push", "origin", "HEAD:" + branch], { stdio: "inherit" });
