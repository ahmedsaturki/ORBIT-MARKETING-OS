#!/usr/bin/env node
/**
 * Release evidence: writes SHA256SUMS.txt for every file in dist/.
 * The exact artifact that passed validation is the artifact distributed.
 */
import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "dist");

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else {
      files.push(full);
    }
  }
  return files;
}

async function main() {
  try {
    await stat(distDir);
  } catch {
    console.error("dist/ not found. Run `npm run build` first.");
    process.exit(1);
  }

  const files = (await walk(distDir)).filter(
    (file) => path.basename(file) !== "SHA256SUMS.txt",
  );
  const lines = [];
  for (const file of files.sort()) {
    const content = await readFile(file);
    const hash = createHash("sha256").update(content).digest("hex");
    const rel = path.relative(distDir, file).split(path.sep).join("/");
    lines.push(`${hash}  ${rel}`);
  }

  const out = path.join(distDir, "SHA256SUMS.txt");
  await writeFile(out, lines.join("\n") + "\n", "utf8");
  console.log(`Wrote ${lines.length} checksums to dist/SHA256SUMS.txt`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
