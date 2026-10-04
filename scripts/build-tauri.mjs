/**
 * Build the production Tauri desktop shell with the correct MSVC environment on machines
 * where a standalone GNU Rust install shadows rustup on PATH.
 *
 * - builds the desktop frontend first; `tauri::generate_context!` embeds
 *   frontendDist ("../dist") and aborts the whole build when it is missing
 * - forces the rustup stable-x86_64-pc-windows-msvc toolchain (RUSTC + PATH)
 * - loads vcvars64.bat so link.exe/lib.exe resolve
 * - redirects CARGO_TARGET_DIR to another drive when C: is nearly full
 * - release builds enable the `custom-protocol` feature so dist/ is embedded
 *
 * Usage: node scripts/build-tauri.mjs [--release]
 */
import { spawnSync } from "node:child_process";
import { existsSync, statfsSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { homedir, tmpdir } from "node:os";
import { spawnPnpm } from "./lib/spawn-pnpm.mjs";

const release = process.argv.includes("--release");
const root = join(import.meta.dirname, "..");
const desktopTauriRoot = join(root, "packages", "desktop", "src-tauri");

function findVcvars() {
  const candidates = [
    `${process.env["ProgramFiles(x86)"] ?? "C:/Program Files (x86)"}/Microsoft Visual Studio/18/BuildTools/VC/Auxiliary/Build/vcvars64.bat`,
    `${process.env["ProgramFiles(x86)"] ?? "C:/Program Files (x86)"}/Microsoft Visual Studio/2022/BuildTools/VC/Auxiliary/Build/vcvars64.bat`,
    `${process.env["ProgramFiles"] ?? "C:/Program Files"}/Microsoft Visual Studio/2022/Community/VC/Auxiliary/Build/vcvars64.bat`,
    `${process.env["ProgramFiles"] ?? "C:/Program Files"}/Microsoft Visual Studio/2022/Enterprise/VC/Auxiliary/Build/vcvars64.bat`,
  ];
  const found = candidates.find((c) => existsSync(c));
  if (!found) {
    console.error(
      "vcvars64.bat not found — install Visual Studio Build Tools.",
    );
    process.exit(1);
  }
  return found;
}

function findRustc() {
  const r = spawnSync(
    "rustup",
    ["which", "rustc", "--toolchain", "stable-x86_64-pc-windows-msvc"],
    {
      encoding: "utf8",
    },
  );
  if (r.status !== 0 || !r.stdout?.trim()) {
    console.error(
      "rustup stable-x86_64-pc-windows-msvc toolchain not found (rustup toolchain install stable).",
    );
    process.exit(1);
  }
  return r.stdout.trim();
}

function pickTargetDir() {
  if (process.env.CARGO_TARGET_DIR) return process.env.CARGO_TARGET_DIR;
  try {
    const cFree = statfsSync("C:/").bavail * statfsSync("C:/").bsize;
    if (cFree < 4 * 1024 ** 3 && existsSync("D:/")) {
      const dir = "D:/orbit-cargo-target";
      console.log(
        `C: has ${(cFree / 1024 ** 3).toFixed(1)} GB free — using ${dir}`,
      );
      return dir;
    }
  } catch {
    /* fall through to default */
  }
  return null;
}

// tauri::generate_context! embeds frontendDist at compile time and fails with
// `the frontendDist configuration is set to "../dist" but this path doesn't
// exist` when it is absent. Build the renderer (and the workspace packages it
// imports, which resolve through their own dist/) before invoking cargo.

const distDir = join(root, "packages", "desktop", "dist");
if (!existsSync(distDir)) {
  console.log("packages/desktop/dist missing — building desktop frontend");
  const frontend = spawnPnpm(
    ["--filter", "@orbit/desktop...", "build"],
    { cwd: root, stdio: "inherit" },
  );
  if (frontend.status !== 0 || !existsSync(distDir)) {
    console.error(
      "desktop frontend build failed; cannot proceed to cargo build.",
    );
    process.exit(1);
  }
}

const vcvars = findVcvars();
const rustc = findRustc();
const rustcBin = rustc.replace(/[\\/]rustc(\.exe)?$/, "");
const targetDir = pickTargetDir();

const cargoArgs = ["build", "--target", "x86_64-pc-windows-msvc"];
if (release) cargoArgs.push("--release", "--features", "custom-protocol");

// cmd.exe cannot receive nested quotes reliably through spawnSync argument
// escaping — stage the environment setup in a batch file instead.
const lines = [
  "@echo off",
  `call "${vcvars}" >nul 2>&1`,
  `set "RUSTC=${rustc}"`,
  `set "PATH=${rustcBin};${join(homedir(), ".cargo")}/bin;%PATH%"`,
];
if (targetDir) lines.push(`set "CARGO_TARGET_DIR=${targetDir}"`);
lines.push(`cargo ${cargoArgs.join(" ")}`);
lines.push("exit /b %ERRORLEVEL%");

const bat = join(tmpdir(), `orbit-tauri-build-${process.pid}.bat`);
writeFileSync(bat, lines.join("\r\n"));
console.log(`cargo ${cargoArgs.join(" ")}`);
let code = 1;
try {
  const res = spawnSync("cmd", ["/c", bat], {
    cwd: desktopTauriRoot,
    stdio: "inherit",
  });
  code = res.status ?? 1;
} finally {
  try {
    unlinkSync(bat);
  } catch {
    /* already removed */
  }
}
process.exit(code);
