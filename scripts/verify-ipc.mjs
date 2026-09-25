import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const rustRoot = join(root, "packages", "desktop", "src-tauri", "src");
const uiRoot = join(root, "packages", "desktop", "src");

async function collectRustSourcePaths(dir) {
  const paths = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      paths.push(...(await collectRustSourcePaths(full)));
    } else if (entry.isFile() && entry.name.endsWith(".rs")) {
      paths.push(full);
    }
  }
  return paths;
}

const rustSources = await collectRustSourcePaths(rustRoot);
const rustContents = await Promise.all(
  rustSources.map((path) => readFile(path, "utf8")),
);
const rust = rustContents.join("\n");

async function collectUiSourcePaths(dir) {
  const paths = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      paths.push(...(await collectUiSourcePaths(full)));
    } else if (
      entry.isFile() &&
      (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))
    ) {
      paths.push(full);
    }
  }
  return paths;
}

const uiSources = await collectUiSourcePaths(uiRoot);
const uiContents = await Promise.all(
  uiSources.map((path) => readFile(path, "utf8")),
);
const ui = uiContents.join("\n");

const rustCommands = new Set(
  [
    ...rust.matchAll(
      /#\[tauri::command\](?:\s*#\[[^\n]+\])*\s*(?:pub\s+)?(?:async\s*)?fn\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g,
    ),
  ].map((match) => match[1]),
);

const handlerBody =
  rust.match(/tauri::generate_handler!\[([\s\S]*?)\]/)?.[1] ?? "";
const registeredCommands = new Set(
  [
    ...handlerBody.matchAll(
      /([A-Za-z_][A-Za-z0-9_]*(?:::[A-Za-z_][A-Za-z0-9_]*)?)/g,
    ),
  ].map((match) => match[1].split("::").at(-1)),
);

for (const command of registeredCommands) {
  if (!rustCommands.has(command)) {
    throw new Error(
      "Tauri invoke handler registers a function without #[tauri::command]: " +
        command,
    );
  }
}

const approvalRequestSignature = rust.match(
  /fn\s+approval_request\([\s\S]*?\)\s*->/,
);
if (
  !approvalRequestSignature ||
  /requested_by\s*:\s*String/.test(approvalRequestSignature[0])
) {
  throw new Error(
    "approval_request must derive actor identity inside the runtime",
  );
}
const approvalDecisionSignature = rust.match(
  /fn\s+approval_decide\([\s\S]*?\)\s*->/,
);
if (
  !approvalDecisionSignature ||
  /decided_by\s*:\s*String/.test(approvalDecisionSignature[0])
) {
  throw new Error(
    "approval_decide must derive actor identity inside the runtime",
  );
}
if (/approval_request[\s\S]{0,800}requested_by:\s*"local-user"/.test(ui)) {
  throw new Error(
    "Desktop UI must not supply requested_by for approval requests",
  );
}
if (/approval_decide[\s\S]{0,800}decided_by:\s*"local-user"/.test(ui)) {
  throw new Error(
    "Desktop UI must not supply decided_by for approval decisions",
  );
}

function collectInvokeArgumentObjects(source) {
  const segments = [];
  let search = 0;

  while (search < source.length) {
    const match = source.slice(search).match(
      /(?:callNative|invoke)(?:<[^>]+>)?\s*\(/,
    );
    if (!match) break;

    const start = search + match.index;
    const open = source.indexOf("(", start);
    if (open < 0) break;

    let parenDepth = 1;
    let end = -1;
    let inString = false;
    let escaped = false;

    for (let index = open + 1; index < source.length; index += 1) {
      const character = source[index];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (character === "\\") {
          escaped = true;
        } else if (character === '"') {
          inString = false;
        }
        continue;
      }

      if (character === '"') {
        inString = true;
        continue;
      }

      if (character === "(") parenDepth += 1;
      if (character === ")") {
        parenDepth -= 1;
        if (parenDepth === 0) {
          end = index;
          break;
        }
      }
    }

    if (end < 0) break;

    const args = source.slice(open + 1, end);
    let brace = -1;
    inString = false;
    escaped = false;

    for (let index = 0; index < args.length; index += 1) {
      const character = args[index];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (character === "\\") {
          escaped = true;
        } else if (character === '"') {
          inString = false;
        }
        continue;
      }

      if (character === '"') {
        inString = true;
        continue;
      }

      if (character === "{") {
        brace = index;
        break;
      }
    }

    if (brace >= 0) segments.push(args.slice(brace));
    search = end + 1;
  }

  return segments;
}

for (const argumentObject of collectInvokeArgumentObjects(ui)) {
  const snakeCaseKeys = [
    ...argumentObject.matchAll(/\b([A-Za-z][A-Za-z0-9]*_[A-Za-z0-9_]+)\s*:/g),
  ].map((match) => match[1]);

  if (snakeCaseKeys.length > 0) {
    throw new Error(
      "Desktop Tauri invoke args must use camelCase at the JS boundary: " +
        [...new Set(snakeCaseKeys)].join(", "),
    );
  }
}

const uiCommands = new Set(
  [
    ...ui.matchAll(
      /(?:callNative|invoke)(?:<[^>]+>)?\(\s*["']([A-Za-z_][A-Za-z0-9_]*)["']/g,
    ),
  ].map((match) => match[1]),
);

for (const command of uiCommands) {
  if (!rustCommands.has(command)) {
    throw new Error("Desktop UI invokes missing Tauri command: " + command);
  }
  if (!registeredCommands.has(command)) {
    throw new Error(
      "Desktop UI invokes a Tauri command that is not registered: " + command,
    );
  }
}

for (const command of rustCommands) {
  if (!registeredCommands.has(command)) {
    console.warn(
      "Tauri command is not registered in generate_handler!: " + command,
    );
  } else if (!uiCommands.has(command) && !["run"].includes(command)) {
    console.warn("Tauri command has no current UI call site: " + command);
  }
}

console.log(
  "Desktop IPC contract checks passed:",
  JSON.stringify({
    rustSourceFiles: rustSources.length,
    uiSourceFiles: uiSources.length,
    rustCommands: rustCommands.size,
    registeredCommands: registeredCommands.size,
    uiCommands: uiCommands.size,
    uncalledCommands: [...rustCommands].filter(
      (command) => registeredCommands.has(command) && !uiCommands.has(command),
    ),
  }),
);
