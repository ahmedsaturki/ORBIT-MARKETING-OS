import { describe, expect, it } from "vitest";
import { DATABASE_SCHEMA_SQL, DATABASE_SCHEMA_VERSION } from "./schema.js";

describe("canonical database schema contract", () => {
  it("tracks the current desktop schema version", () => {
    expect(DATABASE_SCHEMA_VERSION).toBe(14);
  });

  it("includes the canonical operating-model and experimentation tables", () => {
    for (const table of [
      "marketing_objectives",
      "strategy_documents",
      "audiences",
      "offers",
      "knowledge_sources",
      "knowledge_items",
      "knowledge_evidence",
      "agent_definitions",
      "agent_runs",
      "marketing_policies",
      "work_items",
      "work_dependencies",
      "operational_links",
      "opportunities",
      "insights",
      "operational_events",
      "experiments",
      "experiment_observations",
    ]) {
      expect(DATABASE_SCHEMA_SQL).toContain(
        `CREATE TABLE IF NOT EXISTS ${table}`,
      );
    }
  });

  it("sets SQLite user_version to the canonical version", () => {
    expect(DATABASE_SCHEMA_SQL).toContain("PRAGMA user_version = 14;");
  });
});
