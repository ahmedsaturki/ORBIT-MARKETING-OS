#!/usr/bin/env node
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const modeIndex = process.argv.indexOf("--mode");
const mode =
  modeIndex >= 0
    ? (process.argv[modeIndex + 1] ?? "verification")
    : "verification";
if (!["verification", "commercial"].includes(mode)) {
  console.error("release-readiness=FAIL");
  console.error("Mode must be verification or commercial.");
  process.exit(1);
}

const readinessFile = process.env.ORBIT_READINESS_FILE?.trim();
const path = readinessFile
  ? pathToFileURL(resolve(process.cwd(), readinessFile))
  : new URL("../release/readiness.json", import.meta.url);
let document;

try {
  document = JSON.parse(fs.readFileSync(path, "utf8"));
} catch (error) {
  console.error("release-readiness=FAIL");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

if (
  document.schemaVersion !== 1 ||
  !Array.isArray(document.readinessLevels) ||
  document.readinessLevels.length === 0 ||
  !document.releaseCritical ||
  typeof document.releaseCritical !== "object"
) {
  console.error("release-readiness=FAIL");
  console.error("Invalid readiness schema.");
  process.exit(1);
}

const entries = Object.entries(document.releaseCritical);

function isValidVerifiedAt(value) {
  if (typeof value !== "string") return false;
  const timestamp = value.trim();
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(
      timestamp,
    );
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hours = Number(match[4]);
  const minutes = Number(match[5]);
  const seconds = Number(match[6]);

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    hours > 23 ||
    minutes > 59 ||
    seconds > 59
  ) {
    return false;
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > daysInMonth) return false;

  return !Number.isNaN(Date.parse(timestamp));
}

const invalid = entries.filter(
  ([, value]) =>
    !value ||
    typeof value !== "object" ||
    !document.readinessLevels.includes(value.level) ||
    !Array.isArray(value.evidence) ||
    value.evidence.length === 0 ||
    typeof value.notes !== "string" ||
    (value.level === "L3_PRODUCTION_PROVEN" &&
      (!Array.isArray(value.evidenceRefs) ||
        value.evidenceRefs.length === 0 ||
        !value.evidenceRefs.every(
          (ref) => typeof ref === "string" && ref.trim().length > 0,
        ) ||
        typeof value.verifiedAt !== "string" ||
        !isValidVerifiedAt(value.verifiedAt))),
);
if (invalid.length > 0) {
  console.error("release-readiness=FAIL");
  console.error(
    `Invalid gate levels: ${invalid.map(([key]) => key).join(", ")}`,
  );
  process.exit(1);
}

const l3 = entries.filter(
  ([, value]) => value.level === "L3_PRODUCTION_PROVEN",
);
const blockers = entries.filter(
  ([, value]) => value.level !== "L3_PRODUCTION_PROVEN",
);

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
