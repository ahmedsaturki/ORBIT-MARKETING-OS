/**
 * Shared release-gate model.
 *
 * Single source of truth for deriving gate status from release/readiness.json.
 * Consumed by the CLI checker, the exporter, and the browser dashboard so the
 * three can never disagree on what "blocked" means.
 *
 * A gate is blocked exactly when it has not reached L3_PRODUCTION_PROVEN.
 * This matches scripts/verify-release-readiness.mjs, which is the authority
 * for readiness semantics.
 */

export const L3 = "L3_PRODUCTION_PROVEN";

/** Release-critical gate metadata. The keys must match release/readiness.json. */
export const GATES = {
  source_integrity: {
    name: "Source Integrity",
    owner: "Engineering Team",
    priority: "high",
  },
  build: { name: "Build", owner: "Engineering Team", priority: "high" },
  runtime: { name: "Runtime", owner: "Engineering Team", priority: "high" },
  product_workflows: {
    name: "Product Workflows",
    owner: "Engineering Team",
    priority: "medium",
  },
  security_governance: {
    name: "Security Governance",
    owner: "Engineering Team",
    priority: "medium",
  },
  distribution: {
    name: "Distribution",
    owner: "Engineering Team",
    priority: "high",
  },
  web_production: {
    name: "Web Production",
    owner: "Engineering Team",
    priority: "medium",
  },
  external_connectors: {
    name: "External Connectors",
    owner: "Commercial Team",
    priority: "high",
  },
  sync_network: {
    name: "Sync Network",
    owner: "Engineering Team",
    priority: "medium",
  },
  accessibility: {
    name: "Accessibility",
    owner: "Engineering Team",
    priority: "medium",
  },
  stability_soak: {
    name: "Stability Soak",
    owner: "Engineering Team",
    priority: "high",
  },
  commercial_billing: {
    name: "Commercial Billing",
    owner: "Commercial Team",
    priority: "low",
  },
  legal_commercial: {
    name: "Legal/Commercial",
    owner: "Commercial Team",
    priority: "low",
  },
};

export const GATE_KEYS = Object.keys(GATES);

/** Short level label used in display, e.g. "L3 PRODUCTION PROVEN". */
export function levelLabel(level) {
  return level.replaceAll("_", " ");
}

/** CSS modifier for a level, e.g. "l2-verified". */
export function levelClass(level) {
  return level.toLowerCase().replaceAll("_", "-");
}

/**
 * Derive gate status from a readiness document.
 * Gates absent from readiness.json, and gates with no metadata, are reported
 * via the returned `missing` list rather than silently dropped.
 */
export function deriveGateStatus(readiness) {
  const critical = readiness?.releaseCritical;
  if (!critical || typeof critical !== "object" || Array.isArray(critical)) {
    throw new Error("readiness.releaseCritical must be an object");
  }

  const gates = {};
  const missing = [];

  for (const key of GATE_KEYS) {
    const entry = critical[key];
    if (!entry) {
      missing.push(key);
      continue;
    }

    const meta = GATES[key];
    const level = entry.level;
    const blocked = level !== L3;

    gates[key] = {
      key,
      name: meta.name,
      owner: meta.owner,
      priority: meta.priority,
      level,
      levelLabel: levelLabel(level),
      levelClass: levelClass(level),
      blocked,
      blockingReason: blocked ? (entry.notes ?? "").trim() : "",
      evidence: Array.isArray(entry.evidence) ? entry.evidence : [],
      evidenceRefs: Array.isArray(entry.evidenceRefs) ? entry.evidenceRefs : [],
      verifiedAt:
        typeof entry.verifiedAt === "string" ? entry.verifiedAt : null,
    };
  }

  // A gate added to releaseCritical but absent from GATE_KEYS is dropped by the
  // loop above, leaving stats.total and isAllGatesL3 reporting on a truncated
  // set. That direction has no other defence, so refuse the verdict here.
  //
  // The opposite direction, a modelled gate absent from the document, is
  // already handled without throwing: it is collected into `missing` and
  // isAllGatesL3 compares against GATE_KEYS.length, so a partial document can
  // never be reported ready. Keep it non-fatal so callers can still render the
  // gates that are present.
  const untracked = Object.keys(critical)
    .filter((key) => !GATE_KEYS.includes(key))
    .sort((a, b) => a.localeCompare(b));

  if (untracked.length > 0) {
    throw new Error(
      `readiness.releaseCritical contains gate(s) not modelled in GATES: ${untracked.join(", ")}. ` +
        "Add each to GATES with its owner and priority before trusting a release verdict.",
    );
  }
  return { gates, missing };
}

export function calculateStats(gates) {
  const stats = {
    total: Object.keys(gates).length,
    L1: 0,
    L2: 0,
    L3: 0,
    blocked: 0,
    engineering: 0,
    owner: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const gate of Object.values(gates)) {
    if (gate.level === "L1_IMPLEMENTED") stats.L1++;
    else if (gate.level === "L2_VERIFIED") stats.L2++;
    else if (gate.level === L3) stats.L3++;

    if (gate.blocked) stats.blocked++;

    if (gate.owner === "Engineering Team") stats.engineering++;
    else stats.owner++;

    if (gate.priority === "high") stats.high++;
    else if (gate.priority === "medium") stats.medium++;
    else if (gate.priority === "low") stats.low++;
  }

  return stats;
}

export function isAllGatesL3(gates) {
  const values = Object.values(gates);
  return (
    values.length === GATE_KEYS.length &&
    values.every((gate) => gate.level === L3)
  );
}

// Mirrors the L3 validation in scripts/verify-release-readiness.mjs. Without it
// here, a document with all 13 gates forged to L3 and no evidence at all makes
// isAllGatesL3 return true. That document is rejected by the readiness verifier,
// but this is the function the dashboard and the export call, so a gate must
// not be reported cleared on the strength of a level string alone.
export function isValidL3Evidence(gate) {
  if (gate.level !== L3) return true;
  return (
    Array.isArray(gate.evidenceRefs) &&
    gate.evidenceRefs.length > 0 &&
    gate.evidenceRefs.every(
      (ref) => typeof ref === "string" && ref.trim() !== "",
    ) &&
    typeof gate.verifiedAt === "string" &&
    gate.verifiedAt.trim() !== "" &&
    !Number.isNaN(Date.parse(gate.verifiedAt))
  );
}

// Enforced here as well as in the readiness verifier, because the dashboard and
// the export render these gates without running the verifier first.
const originalIsAllGatesL3 = isAllGatesL3;
export function isReleaseReady(gates) {
  return (
    originalIsAllGatesL3(gates) &&
    Object.values(gates).every((gate) => isValidL3Evidence(gate))
  );
}
