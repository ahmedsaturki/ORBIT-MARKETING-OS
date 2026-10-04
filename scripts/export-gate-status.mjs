#!/usr/bin/env node
/**
 * Exports release-gate status for external reporting.
 *
 * Usage: node scripts/export-gate-status.mjs [--format json|csv|markdown] [--output FILE]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  deriveGateStatus,
  calculateStats,
  isAllGatesL3,
  L3,
} from "./release-gate-model.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Honors the same ORBIT_READINESS_FILE override as the other release scripts,
// so a caller can export any readiness document without editing this file.
const readinessPath = process.env.ORBIT_READINESS_FILE?.trim()
  ? resolve(process.cwd(), process.env.ORBIT_READINESS_FILE.trim())
  : join(repoRoot, "release", "readiness.json");

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : fallback;
};

const requestedFormat = flag("--format", flag("-f", "json"));
const format = requestedFormat === "md" ? "markdown" : requestedFormat;
const outputFile = flag("--output", flag("-o", ""));

const readiness = JSON.parse(readFileSync(readinessPath, "utf8"));
const { gates, missing } = deriveGateStatus(readiness);
const stats = calculateStats(gates);
const allL3 = isAllGatesL3(gates);

const blockedGates = Object.values(gates).filter((gate) => gate.blocked);

const csvCell = (value) => {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const FORMATS = {
  json: () =>
    JSON.stringify(
      {
        exported_at: new Date().toISOString(),
        readiness_file: readinessPath,
        production_ready: allL3,
        required_level: L3,
        missing_from_readiness: missing,
        stats,
        gates,
      },
      null,
      2,
    ),

  csv: () =>
    [
      [
        "key",
        "name",
        "owner",
        "priority",
        "level",
        "blocked",
        "blocking_reason",
        "verified_at",
      ].join(","),
      ...Object.values(gates).map((gate) =>
        [
          gate.key,
          gate.name,
          gate.owner,
          gate.priority,
          gate.level,
          gate.blocked ? "yes" : "no",
          gate.blockingReason,
          gate.verifiedAt ?? "",
        ]
          .map(csvCell)
          .join(","),
      ),
    ].join("\n") + "\n",

  markdown: () => {
    const rows = Object.values(gates)
      .map(
        (gate) =>
          `| \`${gate.key}\` | ${gate.name} | ${gate.owner} | ${gate.priority} | ${gate.levelLabel} | ${gate.blocked ? "blocked" : "clear"} |`,
      )
      .join("\n");

    const blockers = blockedGates
      .map((gate) => `- **${gate.name}** (\`${gate.key}\`) — ${gate.blockingReason || "(no notes recorded)"}`)
      .join("\n");

    return `# ORBIT Release Gate Status

Exported ${new Date().toISOString()} from \`release/readiness.json\`.

Required level for production: **${L3}**

| Metric | Value |
| --- | --- |
| Total gates | ${stats.total} |
| At ${L3} | ${stats.L3} |
| Blocked | ${stats.blocked} |
| Engineering-owned | ${stats.engineering} |
| Owner-controlled | ${stats.owner} |
| High priority | ${stats.high} |
| Production ready | ${allL3 ? "yes" : "no"} |

## Gates

| Key | Gate | Owner | Priority | Level | Status |
| --- | --- | --- | --- | --- | --- |
${rows}

## Blocked

${blockers || "None."}
`;
  },
};

if (!Object.hasOwn(FORMATS, format)) {
  console.error(`unsupported format: ${requestedFormat}`);
  console.error(`supported formats: ${Object.keys(FORMATS).join(", ")}`);
  process.exit(1);
}

const output = FORMATS[format]();

if (outputFile) {
  writeFileSync(resolve(process.cwd(), outputFile), output, "utf8");
  console.log(`gate status (${format}) written to ${outputFile}`);
} else {
  process.stdout.write(output.endsWith("\n") ? output : output + "\n");
}
