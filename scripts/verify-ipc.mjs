import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const rust = await readFile(join(root, "packages/desktop/src-tauri/src/lib.rs"), "utf8");
const app = await readFile(join(root, "packages/desktop/src/App.tsx"), "utf8");

const rustCommands = new Set(
  [...rust.matchAll(/#\[tauri::command\]\s*(?:pub\s+)?(?:async\s*)?fn\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)].map(
    (match) => match[1],
  ),
);

const uiCommands = new Set(
  [...app.matchAll(/(?:callNative|invoke)<[^>]+>\(\s*["']([A-Za-z_][A-Za-z0-9_]*)["']/g)].map(
    (match) => match[1],
  ),
);

for (const command of uiCommands) {
  if (!rustCommands.has(command)) {
    throw new Error("Desktop UI invokes missing Tauri command: " + command);
  }
}

for (const command of rustCommands) {
  if (!uiCommands.has(command) && !["run"].includes(command)) {
    console.warn("Tauri command has no current UI call site: " + command);
  }
}

console.log(
  "Desktop IPC contract checks passed:",
  JSON.stringify({ rustCommands: rustCommands.size, uiCommands: uiCommands.size }),
);
