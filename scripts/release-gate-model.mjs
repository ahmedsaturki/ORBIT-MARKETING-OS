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
  source_integrity: { name: "Source Integrity", owner: "Engineering Team", priority: "high" },
  build: { name: "Build", owner: "Engineering Team", priority: "high" },
  runtime: { name: "Runtime", owner: "Engineering Team", priority: "high" },
  product_workflows: { name: "Product Workflows", owner: "Engineering Team", priority: "medium" },
  security_governance: { name: "Security Governance", owner: "Engineering Team", priority: "medium" },
  distribution: { name: "Distribution", owner: "Engineering Team", priority: "high" },
  web_production: { name: "Web Production", owner: "Engineering Team", priority: "medium" },
  external_connectors: { name: "External Connectors", owner: "Commercial Team", priority: "high" },
  sync_network: { name: "Sync Network", owner: "Engineering Team", priority: "medium" },
  accessibility: { name: "Accessibility", owner: "Engineering Team", priority: "medium" },
  stability_soak: { name: "Stability Soak", owner: "Engineering Team", priority: "high" },
  commercial_billing: { name: "Commercial Billing", owner: "Commercial Team", priority: "low" },
  legal_commercial: { name: "Legal/Commercial", owner: "Commercial Team", priority: "low" },
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
      verifiedAt: typeof entry.verifiedAt === "string" ? entry.verifiedAt : null,
    };
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
  return values.length === GATE_KEYS.length && values.every((gate) => gate.level === L3);
}
