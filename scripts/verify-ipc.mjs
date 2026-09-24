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

const handlerBody = rust.match(/tauri::generate_handler!\[([\s\S]*?)\]/)?.[1] ?? "";
const registeredCommands = new Set(
  [...handlerBody.matchAll(/([A-Za-z_][A-Za-z0-9_]*(?:::[A-Za-z_][A-Za-z0-9_]*)?)/g)].map(
    (match) => match[1].split("::").at(-1),
  ),
);

for (const command of registeredCommands) {
  if (!rustCommands.has(command)) {
    throw new Error("Tauri invoke handler registers a function without #[tauri::command]: " + command);
  }
}

const uiCommands = new Set(
  [...app.matchAll(/(?:callNative|invoke)(?:<[^>]+>)?\(\s*["']([A-Za-z_][A-Za-z0-9_]*)["']/g)].map(
    (match) => match[1],
  ),
);

for (const command of uiCommands) {
  if (!rustCommands.has(command)) {
    throw new Error("Desktop UI invokes missing Tauri command: " + command);
  }
  if (!registeredCommands.has(command)) {
    throw new Error("Desktop UI invokes a Tauri command that is not registered: " + command);
  }
}

for (const command of rustCommands) {
  if (!registeredCommands.has(command)) {
    console.warn("Tauri command is not registered in generate_handler!: " + command);
  } else if (!uiCommands.has(command) && !["run"].includes(command)) {
    console.warn("Tauri command has no current UI call site: " + command);
  }
}

console.log(
  "Desktop IPC contract checks passed:",
  JSON.stringify({
    rustCommands: rustCommands.size,
    registeredCommands: registeredCommands.size,
    uiCommands: uiCommands.size,
  }),
);
