/**
 * Generate packages/desktop/src-tauri/icons/icon.ico from the production desktop SVG brand icon.
 * Rasterizes via headless Chromium (Playwright), packs PNG frames into ICO.
 * Usage: node scripts/build-icon.mjs
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(
  join(root, "packages/desktop/src-tauri/icon-source.svg"),
  "utf8",
);
const outDir = join(root, "packages/desktop/src-tauri/icons");
mkdirSync(outDir, { recursive: true });

const sizes = [256, 48, 32];
const browser = await chromium.launch();
const page = await browser.newPage();
const pngFrames = [];
try {
  for (const size of sizes) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<!doctype html><style>*{margin:0;padding:0}html,body{width:${size}px;height:${size}px;background:transparent}</style>${svg
        .replace(/width="\d+"/, `width="${size}"`)
        .replace(/height="\d+"/, `height="${size}"`)}`,
    );
    const buf = await page.screenshot({
      clip: { x: 0, y: 0, width: size, height: size },
    });
    pngFrames.push({ size, png: buf });
  }
} finally {
  await browser.close();
}

// ICO container: ICONDIR + ICONDIRENTRY[] + concatenated PNG frames.
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(pngFrames.length, 4);
let offset = 6 + 16 * pngFrames.length;
const entries = [];
for (const { size, png } of pngFrames) {
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0);
  entry.writeUInt8(size >= 256 ? 0 : size, 1);
  entry.writeUInt8(0, 2); // palette colors
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += png.length;
  entries.push(entry);
}
const ico = Buffer.concat([header, ...entries, ...pngFrames.map((f) => f.png)]);
writeFileSync(join(outDir, "icon.ico"), ico);
console.log(
  `icon.ico written (${ico.length} bytes, frames: ${pngFrames.map((f) => f.size).join(",")})`,
);
