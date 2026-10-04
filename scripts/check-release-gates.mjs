#!/usr/bin/env node
/**
 * ORBIT Release Gates Check
 *
 * Reports every release-critical gate and whether it has reached
 * L3_PRODUCTION_PROVEN. Exits non-zero when the commercial release bar is
 * unmet, so CI can gate on it.
 *
 * Usage: node scripts/check-release-gates.mjs [--json] [--commercial]
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  deriveGateStatus,
  calculateStats,
  isReleaseReady,
  L3,
} from "./release-gate-model.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readinessPath = process.env.ORBIT_READINESS_FILE?.trim()
  ? resolve(process.cwd(), process.env.ORBIT_READINESS_FILE.trim())
  : join(repoRoot, "release", "readiness.json");

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const commercial = args.includes("--commercial");

if (!existsSync(readinessPath)) {
  console.error(`readiness file not found: ${readinessPath}`);
  process.exit(1);
}

let readiness;
try {
  readiness = JSON.parse(readFileSync(readinessPath, "utf8"));
} catch (error) {
  console.error(`failed to parse ${readinessPath}: ${error.message}`);
  process.exit(1);
}

let gates;
let missing;
try {
  ({ gates, missing } = deriveGateStatus(readiness));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const stats = calculateStats(gates);
const allL3 = isReleaseReady(gates);
const blocked = Object.values(gates).filter((gate) => gate.blocked);

if (asJson) {
  console.log(
    JSON.stringify(
      {
        readiness_file: readinessPath,
        gates,
        stats,
        missing,
        all_gates_l3: allL3,
      },
      null,
      2,
    ),
  );
} else {
  const width = Math.max(
    ...Object.values(gates).map((gate) => gate.name.length),
  );
  console.log(
    `release-gates total=${stats.total} l3=${stats.L3} blocked=${stats.blocked}`,
  );
  if (missing.length > 0) {
    console.log(`missing-from-readiness: ${missing.join(", ")}`);
  }
  for (const gate of Object.values(gates)) {
    console.log("");
    console.log(`  ${gate.name.padEnd(width)}  ${gate.levelLabel}`);
    console.log(
      `  ${" ".repeat(width)}  owner=${gate.owner} priority=${gate.priority}`,
    );
    if (gate.blocked) {
      console.log(
        `  ${" ".repeat(width)}  BLOCKED: ${gate.blockingReason || "(no notes recorded)"}`,
      );
    } else {
      console.log(
        `  ${" ".repeat(width)}  verifiedAt=${gate.verifiedAt ?? "unrecorded"}`,
      );
    }
  }
  console.log("");
  console.log(
    allL3
      ? `all ${stats.total} gates at ${L3}: production proven`
      : `${stats.L3}/${stats.total} gates at ${L3}; ${stats.blocked} blocked`,
  );
}

if (commercial && !allL3) {
  console.error(`commercial production proven requires all gates at ${L3}`);
  process.exit(1);
}

process.exit(allL3 ? 0 : 1);
