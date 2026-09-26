#!/usr/bin/env node
import fs from "node:fs";

const modeIndex = process.argv.indexOf("--mode");
const mode = modeIndex >= 0 ? process.argv[modeIndex + 1] ?? "verification" : "verification";
const path = new URL("../release/readiness.json", import.meta.url);
let document;

try {
  document = JSON.parse(fs.readFileSync(path, "utf8"));
} catch (error) {
  console.error("release-readiness=FAIL");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

if (document.schemaVersion !== 1 || !document.releaseCritical || typeof document.releaseCritical !== "object") {
  console.error("release-readiness=FAIL");
  console.error("Invalid readiness schema.");
  process.exit(1);
}

const entries = Object.entries(document.releaseCritical);
const invalid = entries.filter(([, value]) => !value || !document.readinessLevels.includes(value.level));
if (invalid.length > 0) {
  console.error("release-readiness=FAIL");
  console.error(`Invalid gate levels: ${invalid.map(([key]) => key).join(", ")}`);
  process.exit(1);
}

const l3 = entries.filter(([, value]) => value.level === "L3_PRODUCTION_PROVEN");
const blockers = entries.filter(([, value]) => value.level !== "L3_PRODUCTION_PROVEN");

console.log(`release-readiness=PASS mode=${mode}`);
console.log(`release-critical-gates=${entries.length}`);
console.log(`production-proven=${l3.length}`);
console.log(`remaining-gates=${blockers.length}`);

for (const [key, value] of blockers) {
  console.log(`BLOCKED ${key}: ${value.notes}`);
}

if (mode === "commercial" && blockers.length > 0) {
  console.error("commercial-release=BLOCKED");
  console.error(document.rule);
  process.exit(2);
}

if (!["verification", "commercial"].includes(mode)) {
  console.error("release-readiness=FAIL");
  console.error("Mode must be verification or commercial.");
  process.exit(1);
}
