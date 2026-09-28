#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(scriptDir);
const readinessPath = join(repoRoot, "release", "readiness.json");
const readiness = JSON.parse(await readFile(readinessPath, "utf8"));

function git(args) {
  const env = { ...process.env };
  for (const key of [
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_INDEX_FILE",
    "GIT_COMMON_DIR",
    "GIT_OBJECT_DIRECTORY",
    "GIT_ALTERNATE_OBJECT_DIRECTORIES",
    "GIT_NAMESPACE",
  ]) {
    delete env[key];
  }
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    env,
  }).trim();
}

if (git(["rev-parse", "--show-toplevel"]) !== repoRoot) {
  throw new Error("release triage repository root mismatch");
}

const gates = Object.entries(readiness.releaseCritical ?? {}).map(
  ([key, value]) => ({
    key,
    level: value.level,
    notes: value.notes,
    evidence: value.evidence ?? [],
    evidenceRefs: value.evidenceRefs ?? [],
    verifiedAt: value.verifiedAt ?? null,
  }),
);

const ownerActionKeys = new Set([
  "external_connectors",
  "sync_network",
  "accessibility",
  "stability_soak",
  "commercial_billing",
  "legal_commercial",
]);
const mixedActionKeys = new Set(["distribution"]);

const classify = (gate) => {
  if (gate.level === "L3_PRODUCTION_PROVEN") return "PRODUCTION_PROVEN";
  if (ownerActionKeys.has(gate.key)) return "OWNER_ACTION";
  if (mixedActionKeys.has(gate.key)) {
    return "MIXED_ENGINEERING_AND_OWNER_ACTION";
  }
  if (
    [
      "source_integrity",
      "build",
      "runtime",
      "product_workflows",
      "security_governance",
      "web_production",
    ].includes(gate.key)
  ) {
    return "ENGINEERING_OR_VERIFICATION";
  }
  return "REVIEW";
};

const nextActions = gates
  .filter((gate) => gate.level !== "L3_PRODUCTION_PROVEN")
  .map((gate) => {
    const classification = classify(gate);
    const action = {
      key: gate.key,
      class: classification,
      level: gate.level,
      action: gate.notes,
    };
    if (gate.key === "distribution") {
      action.engineeringAction =
        "Validate package generation, checksums, and release artifacts on the exact release SHA.";
      action.ownerAction =
        "Provide desktop signing/notarization identities and production mobile store signing/distribution credentials.";
    }
    return action;
  });

const payload = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  repository: "ahmedsaturki/ORBIT-MARKETING-OS",
  git: {
    sha: git(["rev-parse", "HEAD"]),
    branch: git(["branch", "--show-current"]),
    status: git(["status", "--porcelain"]),
  },
  rule: readiness.rule,
  summary: {
    releaseCriticalCount: gates.length,
    productionProvenCount: gates.filter(
      (gate) => gate.level === "L3_PRODUCTION_PROVEN",
    ).length,
    engineeringOrVerificationCount: gates.filter((gate) =>
      [
        "ENGINEERING_OR_VERIFICATION",
        "MIXED_ENGINEERING_AND_OWNER_ACTION",
      ].includes(classify(gate)),
    ).length,
    ownerActionCount: gates.filter((gate) =>
      ["OWNER_ACTION", "MIXED_ENGINEERING_AND_OWNER_ACTION"].includes(
        classify(gate),
      ),
    ).length,
    blockedCount: gates.filter(
      (gate) => gate.level !== "L3_PRODUCTION_PROVEN",
    ).length,
  },
  nextActions,
  gates,
};

process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
