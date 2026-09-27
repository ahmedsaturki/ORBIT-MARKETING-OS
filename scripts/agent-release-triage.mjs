#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const readinessPath = new URL("../release/readiness.json", import.meta.url);
const readiness = JSON.parse(await readFile(readinessPath, "utf8"));

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

const gates = Object.entries(readiness.releaseCritical ?? {}).map(([key, value]) => ({
  key,
  level: value.level,
  notes: value.notes,
  evidence: value.evidence ?? [],
  evidenceRefs: value.evidenceRefs ?? [],
  verifiedAt: value.verifiedAt ?? null,
}));

const ownerActionKeys = new Set([
  "external_connectors",
  "sync_network",
  "accessibility",
  "stability_soak",
  "commercial_billing",
  "legal_commercial",
]);

const localVerificationKeys = new Set([
  "source_integrity",
  "build",
  "runtime",
  "product_workflows",
  "security_governance",
  "distribution",
  "web_production",
]);

const classify = (gate) => {
  if (gate.level === "L3_PRODUCTION_PROVEN") return "PRODUCTION_PROVEN";
  if (ownerActionKeys.has(gate.key)) return "OWNER_ACTION";
  if (localVerificationKeys.has(gate.key)) return "ENGINEERING_OR_VERIFICATION";
  return "REVIEW";
};

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
    productionProvenCount: gates.filter((gate) => gate.level === "L3_PRODUCTION_PROVEN").length,
    engineeringOrVerificationCount: gates.filter((gate) => classify(gate) === "ENGINEERING_OR_VERIFICATION").length,
    ownerActionCount: gates.filter((gate) => classify(gate) === "OWNER_ACTION").length,
    blockedCount: gates.filter((gate) => gate.level !== "L3_PRODUCTION_PROVEN").length,
  },
  nextActions: gates
    .filter((gate) => gate.level !== "L3_PRODUCTION_PROVEN")
    .map((gate) => ({
      key: gate.key,
      class: classify(gate),
      level: gate.level,
      action: gate.notes,
    })),
  gates,
};

process.stdout.write(JSON.stringify(payload, null, 2) + "\n");