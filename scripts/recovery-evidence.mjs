#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = resolve(root, "packages/desktop/src-tauri/Cargo.toml");
const evidenceDir = resolve(root, ".artifacts");
mkdirSync(evidenceDir, { recursive: true });

const checks = [
  {
    id: "startup-recovery",
    test: "startup_recovery_requeues_sync_and_halts_external_work",
    description:
      "Requeue interrupted sync work, park interrupted external work for human recovery, write recovery audit events, and verify the audit chain.",
  },
  {
    id: "database-recovery",
    test: "database_recovery_restores_missing_primary_and_cleans_transients",
    description:
      "Restore a missing primary SQLite database from the previous copy and remove stale restore/backup source artifacts.",
  },
  {
    id: "recovery-idempotency",
    test:
      "interrupted_external_tasks_require_human_recovery_but_sync_tasks_requeue",
    description:
      "Recover interrupted tasks once, prove a second recovery is a no-op, and preserve the sync-vs-external recovery state boundary.",
  },
  {
    id: "migration-idempotency",
    test:
      "schema_migration_reaches_current_version_and_is_idempotent_afterwards",
    description:
      "Apply the production schema migration to the current version and prove a second migration is a no-op.",
  },
];

const results = [];
for (const check of checks) {
  const started = Date.now();
  try {
    execFileSync(
      "cargo",
      ["test", "--manifest-path", manifest, check.test, "--", "--nocapture"],
      {
        cwd: root,
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "utf8",
        timeout: 4 * 60 * 1000,
        env: process.env,
      },
    );
    results.push({
      id: check.id,
      test: check.test,
      description: check.description,
      status: "PASS",
      elapsedMs: Date.now() - started,
    });
  } catch (error) {
    const stdout =
      typeof error?.stdout === "string" ? error.stdout.slice(-1200) : "";
    const stderr =
      typeof error?.stderr === "string" ? error.stderr.slice(-1200) : "";
    results.push({
      id: check.id,
      test: check.test,
      description: check.description,
      status: "FAIL",
      elapsedMs: Date.now() - started,
      diagnostics: [stdout, stderr].filter(Boolean).join("\n"),
    });
  }
}

const pass = results.every((result) => result.status === "PASS");
const payload = {
  schemaVersion: 1,
  repository: "ahmedsaturki/ORBIT-MARKETING-OS",
  generatedAt: new Date().toISOString(),
  sha: execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
  }).trim(),
  checks: results,
  summary: {
    total: results.length,
    passed: results.filter((result) => result.status === "PASS").length,
    failed: results.filter((result) => result.status !== "PASS").length,
  },
  releaseTruth: {
    promotesToL3: false,
    note: "This artifact consolidates reproducible recovery/migration evidence for the exact SHA. It does not claim external production proof.",
  },
};

const output = resolve(evidenceDir, "recovery-evidence.json");
writeFileSync(output, JSON.stringify(payload, null, 2) + "\n", "utf8");
console.log(JSON.stringify(payload));

if (!pass) process.exit(1);
