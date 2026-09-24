import { execFileSync } from "node:child_process";
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
let failed = false;

function run(command, args, label, expected) {
  try {
    const output = execFileSync(command, args, { cwd: root, encoding: "utf8" }).trim();
    console.log(label + ": " + output);
    if (expected && output !== expected) {
      console.error(label + " version mismatch; expected " + expected);
      failed = true;
    }
  } catch {
    console.error("Missing/unusable " + label + " (" + command + ")");
    failed = true;
  }
}

run("node", ["--version"], "Node");
run("pnpm", ["--version"], "pnpm", "10.17.1");
run("git", ["--version"], "Git");
run("rustc", ["--version"], "Rust");
run("cargo", ["--version"], "Cargo");

for (const path of [
  "pnpm-lock.yaml",
  "packages/desktop/src-tauri/Cargo.lock",
]) {
  try {
    await access(join(root, path));
  } catch {
    console.error("Missing required lockfile: " + path);
    failed = true;
  }
}

if (process.env.GITHUB_ACTIONS === "true" && process.env.RUNNER_OS) {
  console.log("GitHub runner: " + process.env.RUNNER_OS + " / " + (process.env.RUNNER_ARCH ?? "unknown"));
}

if (failed) {
  console.error("Runner preflight failed.");
  process.exit(1);
}

console.log("Runner preflight passed.");
