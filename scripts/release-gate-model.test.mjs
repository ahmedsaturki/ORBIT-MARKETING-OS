import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  GATE_KEYS,
  L3,
  calculateStats,
  deriveGateStatus,
  isAllGatesL3,
  levelClass,
  levelLabel,
} from "./release-gate-model.mjs";

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const readinessPath = join(repoRoot, "release", "readiness.json");
const readiness = JSON.parse(readFileSync(readinessPath, "utf8"));

/**
 * Promote every gate to L3. L3 additionally requires evidenceRefs and
 * verifiedAt, which scripts/verify-release-readiness.mjs enforces, so the
 * fixture must supply them to be a legitimate production-proven document.
 */
const promote = (document) => {
  const copy = JSON.parse(JSON.stringify(document));
  for (const gate of Object.values(copy.releaseCritical)) {
    gate.level = L3;
    gate.evidenceRefs = [
      ...(gate.evidenceRefs ?? []),
      "https://example.test/evidence",
    ];
    gate.verifiedAt = "2026-10-04T00:00:00Z";
  }
  return copy;
};

// Gate metadata must stay aligned with the real readiness document.
const current = deriveGateStatus(readiness);
assert.deepEqual(
  Object.keys(current.gates).sort(),
  [...GATE_KEYS].sort(),
  "every tracked gate resolves from release/readiness.json",
);
assert.deepEqual(current.missing, []);

assert.equal(levelLabel(L3), "L3 PRODUCTION PROVEN");
assert.equal(levelClass(L3), "l3-production-proven");
assert.equal(levelClass("L1_IMPLEMENTED"), "l1-implemented");

// "Blocked" means "not production proven", never "has notes". Every gate in the
// real document carries notes, so a notes-based rule marks all 13 blocked
// forever and can never report production ready.
const currentStats = calculateStats(current.gates);
assert.equal(current.gates.web_production.blocked, true);
assert.ok(current.gates.web_production.blockingReason.length > 0);

const promoted = promote(readiness);
const allL3 = deriveGateStatus(promoted);
const allL3Stats = calculateStats(allL3.gates);

assert.equal(allL3Stats.L3, GATE_KEYS.length);
assert.equal(allL3Stats.blocked, 0);
assert.equal(isAllGatesL3(allL3.gates), true);
for (const gate of Object.values(allL3.gates)) {
  assert.equal(gate.blocked, false, `${gate.key} clears when proven`);
  assert.equal(
    gate.blockingReason,
    "",
    `${gate.key} reports no blocker when proven`,
  );
}

// A single gate short must keep the release blocked.
const oneShort = promote(readiness);
const [firstKey] = GATE_KEYS;
oneShort.releaseCritical[firstKey].level = "L2_VERIFIED";
const shortStats = calculateStats(deriveGateStatus(oneShort).gates);
assert.equal(shortStats.L3, GATE_KEYS.length - 1);
assert.equal(shortStats.blocked, 1);
assert.equal(isAllGatesL3(deriveGateStatus(oneShort).gates), false);

// A gate missing from readiness is reported, not silently dropped.
const missingGate = JSON.parse(JSON.stringify(readiness));
delete missingGate.releaseCritical[firstKey];
const missing = deriveGateStatus(missingGate);
assert.deepEqual(missing.missing, [firstKey]);
assert.equal(
  isAllGatesL3(missing.gates),
  false,
  "an incomplete gate set is never all-L3",
);

// Malformed input is rejected rather than reported as ready.
for (const bad of [{}, { releaseCritical: [] }, { releaseCritical: null }]) {
  assert.throws(
    () => deriveGateStatus(bad),
    /releaseCritical must be an object/,
  );
}

// The model must agree with scripts/verify-release-readiness.mjs, the authority
// for readiness semantics, on every fixture.
const authorityLevel = (file) => {
  const stdout = execFileSync(
    "node",
    ["scripts/verify-release-readiness.mjs"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, ORBIT_READINESS_FILE: file },
    },
  );
  return Number(/production-proven=(\d+)/.exec(stdout)[1]);
};

const tempDirectory = mkdtempSync(join(tmpdir(), "orbit-gate-model-"));
try {
  assert.equal(authorityLevel(readinessPath), currentStats.L3);

  const promotedPath = join(tempDirectory, "promoted.json");
  writeFileSync(promotedPath, JSON.stringify(promoted));
  assert.equal(authorityLevel(promotedPath), allL3Stats.L3);

  const oneShortPath = join(tempDirectory, "one-short.json");
  writeFileSync(oneShortPath, JSON.stringify(oneShort));
  assert.equal(authorityLevel(oneShortPath), shortStats.L3);
} finally {
  rmSync(tempDirectory, { recursive: true, force: true });
}

// The readiness document is a truth claim about this repository, so any file
// it names as evidence must actually exist. Without this, a gate can cite a
// script or artifact that was deleted or renamed and still read as verified.
for (const gate of Object.values(readiness.releaseCritical)) {
  for (const claim of gate.evidence ?? []) {
    // Only paths with a real repository prefix are repo claims. A bare
    // "/api/health.json" is an endpoint probe, not a file reference.
    const named = claim.match(
      /(?:^|[\s(])((?:scripts|docs|logs|release|e2e|packages|src|test)\/[\w./-]+\.[a-z]+)\b/,
    );
    if (!named) {
      continue;
    }
    const relative = named[1];
    if (!existsSync(join(repoRoot, relative))) {
      throw new Error(
        `readiness gate cites missing evidence file: ${relative}`,
      );
    }
  }
}

console.log("release-gate-model=PASS");
