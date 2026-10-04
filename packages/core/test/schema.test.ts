import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import {
  DATABASE_SCHEMA_SQL,
  DATABASE_SCHEMA_VERSION,
} from "../src/database/schema.js";

describe("database schema contract", () => {
  it("uses the current schema version", () => {
    expect(DATABASE_SCHEMA_VERSION).toBe(17);
  });

  it("enforces tenant ownership on core records", () => {
    expect(DATABASE_SCHEMA_SQL).toContain(
      "workspace_id TEXT NOT NULL REFERENCES workspaces(id)",
    );
    expect(DATABASE_SCHEMA_SQL).toContain(
      "REFERENCES workspaces(id) ON DELETE CASCADE",
    );
  });

  it("enforces task idempotency and bounded retry counts", () => {
    expect(DATABASE_SCHEMA_SQL).toContain(
      "UNIQUE(workspace_id, idempotency_key)",
    );
    expect(DATABASE_SCHEMA_SQL).toContain(
      "max_attempts INTEGER NOT NULL DEFAULT 3",
    );
  });

  it("has task content linkage", () => {
    expect(DATABASE_SCHEMA_SQL).toContain(
      "content_id TEXT REFERENCES content_items(id) ON DELETE RESTRICT",
    );
  });

  it("has tamper-evident audit columns", () => {
    expect(DATABASE_SCHEMA_SQL).toContain(
      "previous_hash TEXT NOT NULL DEFAULT 'GENESIS'",
    );
    expect(DATABASE_SCHEMA_SQL).toContain("hash TEXT NOT NULL DEFAULT ''");
  });

  it("has persistent local link intelligence and evidence", () => {
    expect(DATABASE_SCHEMA_SQL).toContain(
      "CREATE TABLE IF NOT EXISTS marketing_links",
    );
    expect(DATABASE_SCHEMA_SQL).toContain(
      "CREATE TABLE IF NOT EXISTS marketing_link_evidence",
    );
    expect(DATABASE_SCHEMA_SQL).toContain("UNIQUE(workspace_id, link_key)");
    expect(DATABASE_SCHEMA_SQL).toContain(
      "source_locator TEXT NOT NULL DEFAULT ''",
    );
  });

  it("has first-class approval and conversation primitives", () => {
    expect(DATABASE_SCHEMA_SQL).toContain(
      "CREATE TABLE IF NOT EXISTS approvals",
    );
    expect(DATABASE_SCHEMA_SQL).toContain(
      "CREATE TABLE IF NOT EXISTS conversations",
    );
    expect(DATABASE_SCHEMA_SQL).toContain(
      "account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT",
    );
    expect(DATABASE_SCHEMA_SQL).toContain(
      "UNIQUE(workspace_id, account_id, external_thread_id)",
    );
  });

  it("rejects an insight with no grounding source", () => {
    const database = new DatabaseSync(":memory:");
    try {
      database.exec(DATABASE_SCHEMA_SQL);
      database.exec(
        "INSERT INTO workspaces(id, name, created_at) VALUES ('workspace-a', 'A', '1');",
      );

      const insertUngrounded = database.prepare(
        `INSERT INTO insights(
           id, workspace_id, kind, title, summary, confidence,
           source_ids_json, observed_at, created_at, updated_at
         ) VALUES (?, ?, 'learning', ?, ?, 0.5, ?, '2026-09-25T00:00:00Z', '1', '1')`,
      );

      expect(() =>
        insertUngrounded.run("ungrounded", "workspace-a", "No source", "Empty", "[]"),
      ).toThrow();

      expect(() =>
        insertUngrounded.run(
          "grounded",
          "workspace-a",
          "Has a source",
          "Grounded",
          '["analytics-a"]',
        ),
      ).not.toThrow();

      const stored = database
        .prepare("SELECT COUNT(*) AS total FROM insights")
        .get() as { total: number };
      expect(stored.total).toBe(1);
    } finally {
      database.close();
    }
  });
});
