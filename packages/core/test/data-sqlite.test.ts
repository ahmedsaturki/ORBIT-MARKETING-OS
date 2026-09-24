import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, type Contact, type OrbitDb } from "../src/data/sqlite.js";

function makeContact(id: string, name: string, extra: Partial<Contact> = {}): Contact {
  return {
    id,
    workspaceId: "ws1",
    name,
    email: `${id}@example.com`,
    phone: `+20100000${id.slice(-4).padStart(4, "0")}`,
    tags: ["lead"],
    createdAt: "2026-09-24T00:00:00.000Z",
    updatedAt: "2026-09-24T00:00:00.000Z",
    ...extra,
  };
}

describe("sqlite persistence (DATA-01/02/03)", () => {
  let dir: string;
  let dbPath: string;
  let db: OrbitDb | undefined;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "orbit-db-"));
    dbPath = join(dir, "orbit.db");
    db = undefined;
  });

  afterEach(() => {
    db?.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("opens a clean database and applies all migrations", () => {
    db = openDb(dbPath);
    expect(db.schemaVersion).toBe(2);
    expect(db.countContacts("ws1")).toBe(0);
  });

  it("persists contacts across close and reopen (clean runtime restart)", () => {
    db = openDb(dbPath);
    db.insertContact(makeContact("c1", "Ahmed"));
    db.insertContact(makeContact("c2", "Sara"));
    db.close();

    db = openDb(dbPath);
    expect(db.countContacts("ws1")).toBe(2);
    expect(db.getContact("ws1", "c1")?.name).toBe("Ahmed");
    expect(db.getContact("ws1", "missing")).toBeUndefined();
    expect(db.getContact("other-ws", "c1")).toBeUndefined();
  });

  it("upserts contacts without duplicating rows", () => {
    db = openDb(dbPath);
    db.insertContact(makeContact("c1", "Ahmed"));
    db.insertContact(makeContact("c1", "Ahmed Updated"));
    expect(db.countContacts("ws1")).toBe(1);
    expect(db.getContact("ws1", "c1")?.name).toBe("Ahmed Updated");
  });

  it("applies forward migrations idempotently on reopen", () => {
    db = openDb(dbPath);
    expect(db.schemaVersion).toBe(2);
    db.close();
    db = openDb(dbPath);
    expect(db.schemaVersion).toBe(2);
    db.close();
    db = openDb(dbPath);
    expect(db.schemaVersion).toBe(2);
  });

  it(
    "searches 1,000 contacts by name, email, and tag within limit",
    () => {
      db = openDb(dbPath);
      db.transaction(() => {
        for (let i = 0; i < 1000; i++) {
          const id = `c${String(i).padStart(4, "0")}`;
          db!.insertContact(
            makeContact(id, `Contact ${String(i).padStart(4, "0")}`, {
              email: `user${i}@corp.example`,
              tags: i % 100 === 0 ? ["vip"] : ["lead"],
            }),
          );
        }
      });
      expect(db.countContacts("ws1")).toBe(1000);

      const byName = db.searchContacts("ws1", "Contact 0999");
      expect(byName).toHaveLength(1);
      expect(byName[0]?.id).toBe("c0999");

      const byEmail = db.searchContacts("ws1", "user500@corp");
      expect(byEmail).toHaveLength(1);
      expect(byEmail[0]?.id).toBe("c0500");

      const byTag = db.searchContacts("ws1", "vip");
      expect(byTag).toHaveLength(10);

      const page = db.searchContacts("ws1", "Contact", 10);
      expect(page).toHaveLength(10);
    },
    15000,
  );

  it("links conversations to contacts with foreign-key enforcement", () => {
    db = openDb(dbPath);
    db.insertContact(makeContact("c1", "Ahmed"));
    db.insertConversation({
      id: "conv1",
      workspaceId: "ws1",
      contactId: "c1",
      channel: "whatsapp",
      lastMessageAt: "2026-09-24T01:00:00.000Z",
      status: "open",
      createdAt: "2026-09-24T00:00:00.000Z",
    });
    expect(db.countConversations("ws1")).toBe(1);
    expect(db.getConversation("ws1", "conv1")?.contactId).toBe("c1");

    expect(() =>
      db!.insertConversation({
        id: "conv2",
        workspaceId: "ws1",
        contactId: "ghost",
        channel: "telegram",
        lastMessageAt: "2026-09-24T01:00:00.000Z",
        status: "open",
        createdAt: "2026-09-24T00:00:00.000Z",
      }),
    ).toThrow();
  });
});
