import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readiness = JSON.parse(
  readFileSync(join(repoRoot, "release", "readiness.json"), "utf8"),
);

const run = (args, env = {}) =>
  spawnSync("node", args, {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });

const promote = (document) => {
  const copy = JSON.parse(JSON.stringify(document));
  for (const gate of Object.values(copy.releaseCritical)) {
    gate.level = "L3_PRODUCTION_PROVEN";
    gate.evidenceRefs = [...(gate.evidenceRefs ?? []), "https://example.test/evidence"];
    gate.verifiedAt = "2026-10-04T00:00:00Z";
  }
  return copy;
};

const tempDirectory = mkdtempSync(join(tmpdir(), "orbit-gate-cli-"));
try {
  // The current release is not production proven, so the check must fail the
  // command. A silent exit 0 here would let a blocked release through CI.
  const blocked = run(["scripts/check-release-gates.mjs"]);
  assert.equal(blocked.status, 1, "blocked release exits non-zero");
  assert.match(blocked.stdout, /l3=0 blocked=13/);
  assert.match(blocked.stdout, /0\/13 gates at L3_PRODUCTION_PROVEN/);

  const commercial = run(["scripts/check-release-gates.mjs", "--commercial"]);
  assert.equal(commercial.status, 1);
  assert.match(commercial.stderr, /requires all gates at L3_PRODUCTION_PROVEN/);

  const asJson = run(["scripts/check-release-gates.mjs", "--json"]);
  assert.equal(asJson.status, 1);
  const parsed = JSON.parse(asJson.stdout);
  assert.equal(parsed.all_gates_l3, false);
  assert.equal(parsed.stats.total, 13);
  assert.deepEqual(parsed.missing, []);
  assert.equal(parsed.gates.web_production.blocked, true);

  // Every gate must be reported with a blocker, not just counted.
  const reported = /BLOCKED: /g;
  assert.equal(
    blocked.stdout.match(reported)?.length,
    13,
    "each blocked gate states its blocker",
  );

  const promotedPath = join(tempDirectory, "promoted.json");
  writeFileSync(promotedPath, JSON.stringify(promote(readiness)));

  const proven = run(["scripts/check-release-gates.mjs", "--commercial"], {
    ORBIT_READINESS_FILE: promotedPath,
  });
  assert.equal(proven.status, 0, "a fully proven release exits zero");
  assert.match(proven.stdout, /all 13 gates at L3_PRODUCTION_PROVEN/);

  // Exports must report the same verdict as the checker.
  for (const format of ["json", "csv", "md"]) {
    const exported = run(["scripts/export-gate-status.mjs", "--format", format], {
      ORBIT_READINESS_FILE: promotedPath,
    });
    assert.equal(exported.status, 0, `export ${format} succeeds`);
    assert.ok(exported.stdout.length > 0, `export ${format} produces output`);
  }

  const jsonExport = JSON.parse(
    run(["scripts/export-gate-status.mjs", "--format", "json"], {
      ORBIT_READINESS_FILE: promotedPath,
    }).stdout,
  );
  assert.equal(jsonExport.production_ready, true);
  assert.equal(jsonExport.stats.blocked, 0);

  const blockedCsv = run(["scripts/export-gate-status.mjs", "--format", "csv"]).stdout
    .trim()
    .split("\n");
  assert.equal(blockedCsv.length, 14, "csv has a header plus 13 gates");
  assert.equal(blockedCsv[1].split(",")[5], "yes", "csv marks the gate blocked");

  const outFile = join(tempDirectory, "gates.json");
  const written = run(["scripts/export-gate-status.mjs", "--format", "json", "--output", outFile]);
  assert.equal(written.status, 0);
  assert.equal(JSON.parse(readFileSync(outFile, "utf8")).stats.total, 13);

  assert.equal(
    run(["scripts/export-gate-status.mjs", "--format", "yaml"]).status,
    1,
    "unsupported export format is rejected",
  );

  assert.equal(
    run(["scripts/check-release-gates.mjs"], {
      ORBIT_READINESS_FILE: join(tempDirectory, "absent.json"),
    }).status,
    1,
    "a missing readiness file fails loudly",
  );
} finally {
  rmSync(tempDirectory, { recursive: true, force: true });
}

// The dashboard HTML must not ship a duplicated copy of the gate rules; the
// shared model is the only place level semantics are defined.
const dashboard = readFileSync(
  join(repoRoot, "scripts", "gate-status-dashboard.html"),
  "utf8",
);
assert.match(dashboard, /from "\.\/release-gate-model\.mjs"/);
assert.match(dashboard, /type="module"/);
assert.doesNotMatch(
  dashboard,
  /const GATES = \{/,
  "dashboard must not redefine gate metadata",
);
assert.doesNotMatch(
  dashboard,
  /blocking_reason \? |gate\.notes/,
  "dashboard must not derive blocking from notes",
);

console.log("release-gate-tooling=PASS");
