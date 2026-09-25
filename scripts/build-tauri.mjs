/**
 * Build the Tauri desktop shell with the correct MSVC environment on machines
 * where a standalone GNU Rust install shadows rustup on PATH.
 *
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

const release = process.argv.includes("--release");
const root = join(import.meta.dirname, "..");

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
    cwd: join(root, "src-tauri"),
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
