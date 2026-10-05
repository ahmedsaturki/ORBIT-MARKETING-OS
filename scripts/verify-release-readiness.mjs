#!/usr/bin/env node
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import {
  isValidVerifiedAt,
  isStaleForL3,
  L3_EVIDENCE_MAX_AGE_DAYS,
} from "./release-gate-model.mjs";

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
        !isValidVerifiedAt(value.verifiedAt) ||
        // Evidence currency: a stale or future timestamp cannot support a
        // production-proven claim. Previously only the format was checked, so
        // any past date -- including one predating the release line entirely --
        // satisfied .omp/RULES.md's "exact verification timestamp".
        isStaleForL3(value.verifiedAt))),
);
if (invalid.length > 0) {
  console.error("release-readiness=FAIL");
  console.error(
    `Invalid gate levels: ${invalid.map(([key]) => key).join(", ")} (L3 evidence must be no older than ${L3_EVIDENCE_MAX_AGE_DAYS} days, and not dated in the future)`,
  );
  process.exit(1);
}

const l3 = entries.filter(
  ([, value]) => value.level === "L3_PRODUCTION_PROVEN",
);
const blockers = entries.filter(
  ([, value]) => value.level !== "L3_PRODUCTION_PROVEN",
);

// `releaseTruth.state` is the file's own summary of production truth. Nothing
// else reads it, so without this it could assert a stronger state than the
// gate set supports. It must be no stronger than UNVERIFIED while any
// release-critical gate is below L3_PRODUCTION_PROVEN; once every gate is L3 it
// is unconstrained. Absent releaseTruth data is ignored -- fixtures that model a
// gate at L3 without it stay valid.
const truthState = document.releaseTruth?.state;
if (
  blockers.length > 0 &&
  truthState !== undefined &&
  truthState !== "UNVERIFIED"
) {
  console.error("release-readiness=FAIL");
  console.error(
    `Invalid releaseTruth.state: ${JSON.stringify(truthState)}. ` +
      "While any release-critical gate is below L3_PRODUCTION_PROVEN the file " +
      "must not assert a stronger release state than UNVERIFIED.",
  );
  process.exit(1);
}

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
