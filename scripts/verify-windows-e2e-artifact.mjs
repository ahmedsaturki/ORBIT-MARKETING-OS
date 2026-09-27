import { readFile, stat } from "node:fs/promises";
import { basename } from "node:path";

const executable = process.env.TAURI_EXE?.trim();
const capabilitiesSchema = process.env.ORBIT_CAPABILITIES_SCHEMA?.trim();
if (!executable) throw new Error("TAURI_EXE is required");
if (!capabilitiesSchema)
  throw new Error("ORBIT_CAPABILITIES_SCHEMA is required");

const info = await stat(executable);
if (!info.isFile()) throw new Error("TAURI_EXE must point to a file");
if (basename(executable).toLowerCase() !== "orbit-marketing-os.exe") {
  throw new Error("TAURI_EXE must point to orbit-marketing-os.exe");
}
if (info.size <= 0) throw new Error("TAURI_EXE must be non-empty");

const schemaInfo = await stat(capabilitiesSchema);
if (!schemaInfo.isFile()) {
  throw new Error("ORBIT_CAPABILITIES_SCHEMA must point to a file");
}
if (basename(capabilitiesSchema).toLowerCase() !== "capabilities.json") {
  throw new Error("ORBIT_CAPABILITIES_SCHEMA must point to capabilities.json");
}
const resolved = JSON.parse(await readFile(capabilitiesSchema, "utf8"));
if (
  resolved?.default?.windows?.length !== 1 ||
  resolved.default.windows[0] !== "main"
) {
  throw new Error(
    "Resolved default capability must target only the main window",
  );
}
if (
  !Array.isArray(resolved?.default?.permissions) ||
  resolved.default.permissions.length !== 1 ||
  resolved.default.permissions[0] !== "core:default"
) {
  throw new Error("Resolved default capability must grant only core:default");
}

console.log(
  JSON.stringify({
    status: "passed",
    executable: basename(executable),
    sizeBytes: info.size,
    capabilitiesSchema: basename(capabilitiesSchema),
    resolvedDefault: resolved.default,
  }),
);