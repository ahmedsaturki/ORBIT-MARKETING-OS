import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createBackup,
  restoreBackup,
  verifyBackup,
} from "../src/data/backup.js";
import {
  MIGRATIONS,
  openDb,
  type Contact,
  type OrbitDb,
} from "../src/data/sqlite.js";

function makeContact(id: string, name: string): Contact {
  return {
    id,
    workspaceId: "ws1",
    name,
    email: `${id}@example.com`,
    tags: ["lead"],
    createdAt: "2026-09-24T00:00:00.000Z",
    updatedAt: "2026-09-24T00:00:00.000Z",
  };
}

function createV1Db(path: string, names: readonly string[]): void {
  const db = new DatabaseSync(path);
  db.exec(MIGRATIONS[0]!.up);
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)",
  );
  db.prepare(
    "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
  ).run(1, "2026-01-01T00:00:00.000Z");
  const stmt = db.prepare(`
    INSERT INTO contacts (id, workspace_id, name, tags, created_at, updated_at)
    VALUES (?, 'ws1', ?, '[]', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')
  `);
  names.forEach((name, i) => stmt.run(`v1-${i}`, name));
  db.close();
}

function contactColumns(dbPath: string): string[] {
  const db = new DatabaseSync(dbPath);
  try {
    const rows = db.prepare("PRAGMA table_info(contacts)").all() as Record<
      string,
      unknown
    >[];
    return rows.map((r) => String(r.name));
  } finally {
    db.close();
  }
}

describe("encrypted backup (BACK-01)", () => {
  let dir: string;
  let db: OrbitDb | undefined;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "orbit-backup-"));
    db = undefined;
  });

  afterEach(() => {
    db?.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("round-trips a database through an encrypted backup", () => {
    const dbPath = join(dir, "orbit.db");
    db = openDb(dbPath);
    db.insertContact(makeContact("c1", "Ahmed"));
    db.insertContact(makeContact("c2", "Sara"));
    db.close();
    db = undefined;

    const backupPath = join(dir, "backup.orbbk");
    const info = createBackup(dbPath, backupPath, { passphrase: "correct horse" });
    expect(info.encrypted).toBe(true);
    expect(info.plaintextBytes).toBeGreaterThan(0);

    const raw = readFileSync(backupPath);
    expect(raw.subarray(0, 8).toString("ascii")).toBe("ORBBK001");
    expect(raw.subarray(8, 9)[0]).toBe(1);
    // Ciphertext must not contain the plaintext contact names.
    expect(raw.includes(Buffer.from("Ahmed"))).toBe(false);

    const verified = verifyBackup(backupPath, { passphrase: "correct horse" });
    expect(verified.sha256).toBe(info.sha256);
    expect(verified.encrypted).toBe(true);

    const restoredPath = join(dir, "restored.db");
    restoreBackup(backupPath, restoredPath, { passphrase: "correct horse" });
    db = openDb(restoredPath);
    expect(db.countContacts("ws1")).toBe(2);
    expect(db.getContact("ws1", "c1")?.name).toBe("Ahmed");
    expect(db.getContact("ws1", "c2")?.name).toBe("Sara");
  });

  it("round-trips a plaintext backup when no passphrase is given", () => {
    const dbPath = join(dir, "orbit.db");
    db = openDb(dbPath);
    db.insertContact(makeContact("c1", "Plain"));
    db.close();
    db = undefined;

    const backupPath = join(dir, "plain.orbbk");
    const info = createBackup(dbPath, backupPath);
    expect(info.encrypted).toBe(false);

    const restoredPath = join(dir, "restored.db");
    restoreBackup(backupPath, restoredPath);
    db = openDb(restoredPath);
    expect(db.getContact("ws1", "c1")?.name).toBe("Plain");
  });

  it("restores over an existing destination and clears stale WAL sidecars", () => {
    const dbPath = join(dir, "orbit.db");
    db = openDb(dbPath);
    db.insertContact(makeContact("c1", "First"));
    db.close();
    db = undefined;

    const backupPath = join(dir, "backup.orbbk");
    createBackup(dbPath, backupPath, { passphrase: "pw" });

    // A previous database at the destination with a stale WAL must not
    // contaminate the restored file.
    const destPath = join(dir, "target.db");
    db = openDb(destPath);
    db.insertContact(makeContact("old", "Stale"));
    db.close();
    db = undefined;
    writeFileSync(`${destPath}-wal`, Buffer.from("stale wal bytes"));
    expect(existsSync(`${destPath}-wal`)).toBe(true);

    restoreBackup(backupPath, destPath, { passphrase: "pw" });
    expect(existsSync(`${destPath}-wal`)).toBe(false);
    db = openDb(destPath);
    expect(db.countContacts("ws1")).toBe(1);
    expect(db.getContact("ws1", "c1")?.name).toBe("First");
    expect(db.getContact("ws1", "old")).toBeUndefined();
  });

  it("requires the passphrase to verify an encrypted backup", () => {
    const dbPath = join(dir, "orbit.db");
    db = openDb(dbPath);
    db.insertContact(makeContact("c1", "Secret"));
    db.close();
    db = undefined;

    const backupPath = join(dir, "backup.orbbk");
    createBackup(dbPath, backupPath, { passphrase: "pw" });
    expect(() => verifyBackup(backupPath)).toThrow(/requires passphrase/);
  });
});

describe("corrupt backup rejection (BACK-02)", () => {
  let dir: string;
  let db: OrbitDb | undefined;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "orbit-corrupt-"));
    db = undefined;
  });

  afterEach(() => {
    db?.close();
    rmSync(dir, { recursive: true, force: true });
  });

  function seedAndBackup(passphrase?: string): string {
    const dbPath = join(dir, "orbit.db");
    db = openDb(dbPath);
    db.insertContact(makeContact("c1", "Ahmed"));
    db.close();
    db = undefined;
    const backupPath = join(dir, "backup.orbbk");
    createBackup(dbPath, backupPath, passphrase ? { passphrase } : {});
    return backupPath;
  }

  it("rejects a flipped bit in an encrypted payload", () => {
    const backupPath = seedAndBackup("pw");
    const raw = readFileSync(backupPath);
    const target = raw.length - 5;
    raw[target] = (raw[target] ?? 0) ^ 0xff;
    writeFileSync(backupPath, raw);
    expect(() => verifyBackup(backupPath, { passphrase: "pw" })).toThrow(
      /corrupt/,
    );
    expect(() =>
      restoreBackup(backupPath, join(dir, "bad.db"), { passphrase: "pw" }),
    ).toThrow(/corrupt/);
  });

  it("rejects a flipped bit in a plaintext payload", () => {
    const backupPath = seedAndBackup();
    const raw = readFileSync(backupPath);
    const target = raw.length - 5;
    raw[target] = (raw[target] ?? 0) ^ 0xff;
    writeFileSync(backupPath, raw);
    expect(() => verifyBackup(backupPath)).toThrow(/corrupt/);
  });

  it("rejects a tampered header hash", () => {
    const backupPath = seedAndBackup();
    const raw = readFileSync(backupPath);
    const shaStart = 9; // magic(8) + flags(1)
    raw[shaStart] = (raw[shaStart] ?? 0) ^ 0xff;
    writeFileSync(backupPath, raw);
    expect(() => verifyBackup(backupPath)).toThrow(/corrupt/);
  });

  it("rejects a wrong passphrase", () => {
    const backupPath = seedAndBackup("pw");
    expect(() => verifyBackup(backupPath, { passphrase: "wrong" })).toThrow(
      /corrupt/,
    );
  });

  it("rejects a truncated file", () => {
    const backupPath = seedAndBackup();
    const raw = readFileSync(backupPath);
    writeFileSync(backupPath, raw.subarray(0, 20));
    expect(() => verifyBackup(backupPath)).toThrow(/truncated/);
  });

  it("rejects a file that is not a backup container", () => {
    const bogus = join(dir, "bogus.orbbk");
    writeFileSync(
      bogus,
      Buffer.from("this is definitely not a backup container, just text!"),
    );
    expect(() => verifyBackup(bogus)).toThrow(/magic/);
  });

  it("never restores a corrupt backup over the destination", () => {
    const backupPath = seedAndBackup("pw");
    const destPath = join(dir, "target.db");
    db = openDb(destPath);
    db.insertContact(makeContact("keep", "Keep Me"));
    db.close();
    db = undefined;

    const raw = readFileSync(backupPath);
    raw[raw.length - 1] = (raw[raw.length - 1] ?? 0) ^ 0xff;
    writeFileSync(backupPath, raw);

    expect(() =>
      restoreBackup(backupPath, destPath, { passphrase: "pw" }),
    ).toThrow(/corrupt/);
    db = openDb(destPath);
    expect(db.getContact("ws1", "keep")?.name).toBe("Keep Me");
  });
});

describe("migration safety (DATA-02)", () => {
  let dir: string;
  let db: OrbitDb | undefined;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "orbit-migrate-"));
    db = undefined;
  });

  afterEach(() => {
    db?.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("applies forward migrations to a v1 database without data loss", () => {
    const dbPath = join(dir, "v1.db");
    createV1Db(dbPath, ["Alpha", "Beta"]);

    db = openDb(dbPath);
    expect(db.schemaVersion).toBe(2);
    expect(db.countContacts("ws1")).toBe(2);
    expect(db.getContact("ws1", "v1-0")?.name).toBe("Alpha");
    db.close();
    db = undefined;

    expect(contactColumns(dbPath)).toContain("notes");
  });

  it("restores a pre-migration backup and then migrates it forward", () => {
    const dbPath = join(dir, "v1.db");
    createV1Db(dbPath, ["Gamma", "Delta", "Epsilon"]);

    const backupPath = join(dir, "v1.orbbk");
    createBackup(dbPath, backupPath, { passphrase: "pw" });

    const restoredPath = join(dir, "restored.db");
    restoreBackup(backupPath, restoredPath, { passphrase: "pw" });

    db = openDb(restoredPath);
    expect(db.schemaVersion).toBe(2);
    expect(db.countContacts("ws1")).toBe(3);
    expect(db.getContact("ws1", "v1-2")?.name).toBe("Epsilon");
    expect(db.searchContacts("ws1", "Delta")).toHaveLength(1);
    // Reopen repeatedly: migrations stay idempotent after restore.
    db.close();
    db = openDb(restoredPath);
    expect(db.schemaVersion).toBe(2);
    expect(db.countContacts("ws1")).toBe(3);
  });

  it("rolls back a failing migration atomically", () => {
    const dbPath = join(dir, "conflict.db");
    createV1Db(dbPath, ["Pre"]);
    // Pre-add the `notes` column so migration v2 fails on duplicate column.
    const raw = new DatabaseSync(dbPath);
    raw.exec("ALTER TABLE contacts ADD COLUMN notes TEXT");
    raw.close();

    expect(() => openDb(dbPath)).toThrow(/migration 2 failed/);

    // Rollback must leave schema version at 1 (nothing half-applied)
    // and all rows intact.
    const check = new DatabaseSync(dbPath);
    const row = check
      .prepare("SELECT MAX(version) AS v FROM schema_migrations")
      .get() as { v: number };
    expect(row.v).toBe(1);
    const count = check
      .prepare("SELECT COUNT(*) AS c FROM contacts")
      .get() as { c: number };
    expect(Number(count.c)).toBe(1);
    check.close();
  });
});
