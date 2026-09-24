import { describe, expect, it } from "vitest";
import { DATABASE_SCHEMA_SQL, DATABASE_SCHEMA_VERSION } from "../src/database/schema.js";

describe("database schema contract", () => {
  it("uses the current schema version", () => {
    expect(DATABASE_SCHEMA_VERSION).toBe(3);
  });

  it("enforces tenant ownership on core records", () => {
    expect(DATABASE_SCHEMA_SQL).toContain("workspace_id TEXT NOT NULL REFERENCES workspaces(id)");
    expect(DATABASE_SCHEMA_SQL).toContain("REFERENCES workspaces(id) ON DELETE CASCADE");
  });

  it("enforces task idempotency and bounded retry counts", () => {
    expect(DATABASE_SCHEMA_SQL).toContain("idempotency_key TEXT NOT NULL UNIQUE");
    expect(DATABASE_SCHEMA_SQL).toContain("max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts >= 1)");
  });

  it("has tamper-evident audit columns", () => {
    expect(DATABASE_SCHEMA_SQL).toContain("previous_hash TEXT NOT NULL DEFAULT 'GENESIS'");
    expect(DATABASE_SCHEMA_SQL).toContain("hash TEXT NOT NULL DEFAULT ''");
  });

  it("has first-class approval and conversation primitives", () => {
    expect(DATABASE_SCHEMA_SQL).toContain("CREATE TABLE IF NOT EXISTS approvals");
    expect(DATABASE_SCHEMA_SQL).toContain("CREATE TABLE IF NOT EXISTS conversations");
    expect(DATABASE_SCHEMA_SQL).toContain("UNIQUE(account_id, external_thread_id)");
  });
});
