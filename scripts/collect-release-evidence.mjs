#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const args = process.argv.slice(2);
const outputIndex = args.indexOf("--output");
const output =
  outputIndex >= 0
    ? (args[outputIndex + 1] ?? ".artifacts/release-evidence.json")
    : ".artifacts/release-evidence.json";
const modeIndex = args.indexOf("--mode");
const mode =
  modeIndex >= 0 ? (args[modeIndex + 1] ?? "verification") : "verification";

if (!["verification", "commercial"].includes(mode)) {
  throw new Error("mode must be verification or commercial");
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
const readiness = JSON.parse(
  await readFile(new URL("../release/readiness.json", import.meta.url), "utf8"),
);
const releaseCritical = Object.entries(readiness.releaseCritical ?? {}).map(
  ([key, value]) => ({
    key,
    level: value.level,
    evidence: value.evidence,
    notes: value.notes,
  }),
);
const blockers = releaseCritical.filter(
  (entry) => entry.level !== "L3_PRODUCTION_PROVEN",
);

const evidence = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  mode,
  repository: "ahmedsaturki/ORBIT-MARKETING-OS",
  version: packageJson.version,
  git: {
    sha: git(["rev-parse", "HEAD"]),
    branch: git(["branch", "--show-current"]),
    status: git(["status", "--porcelain"]),
  },
  readiness: {
    schemaVersion: readiness.schemaVersion,
    productionProvenCount: releaseCritical.filter(
      (entry) => entry.level === "L3_PRODUCTION_PROVEN",
    ).length,
    releaseCriticalCount: releaseCritical.length,
    remainingGateCount: blockers.length,
    gates: releaseCritical,
  },
  releasePolicy: readiness.rule,
};

await mkdir(output.slice(0, output.lastIndexOf("/")) || ".", {
  recursive: true,
});
await writeFile(output, JSON.stringify(evidence, null, 2) + "\n", "utf8");

console.log(
  JSON.stringify({
    output,
    sha: evidence.git.sha,
    version: evidence.version,
    productionProven: evidence.readiness.productionProvenCount,
    remainingGates: evidence.readiness.remainingGateCount,
  }),
);

if (mode === "commercial" && blockers.length > 0) {
  console.error("commercial-release=BLOCKED");
  process.exit(2);
}
