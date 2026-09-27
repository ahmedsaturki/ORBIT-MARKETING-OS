import { stat } from "node:fs/promises";
import { basename } from "node:path";

const executable = process.env.TAURI_EXE?.trim();
if (!executable) throw new Error("TAURI_EXE is required");

const info = await stat(executable);
if (!info.isFile()) throw new Error("TAURI_EXE must point to a file");
if (basename(executable).toLowerCase() !== "orbit-marketing-os.exe") {
  throw new Error("TAURI_EXE must point to orbit-marketing-os.exe");
}
if (info.size <= 0) throw new Error("TAURI_EXE must be non-empty");

console.log(JSON.stringify({
  status: "passed",
  executable: basename(executable),
  sizeBytes: info.size,
}));
