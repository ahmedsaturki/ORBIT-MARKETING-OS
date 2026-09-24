import { DatabaseSync, type StatementSync } from "node:sqlite";

export interface Contact {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly email?: string;
  readonly phone?: string;
  readonly tags: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface Conversation {
  readonly id: string;
  readonly workspaceId: string;
  readonly contactId: string;
  readonly channel: string;
  readonly lastMessageAt: string;
  readonly status: "open" | "closed" | "archived";
  readonly createdAt: string;
}

export interface Migration {
  readonly version: number;
  readonly up: string;
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    up: `
      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_contacts_workspace ON contacts(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(workspace_id, name);
      CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(workspace_id, email);
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        contact_id TEXT NOT NULL,
        channel TEXT NOT NULL,
        last_message_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        created_at TEXT NOT NULL,
        FOREIGN KEY (contact_id) REFERENCES contacts(id)
      );
      CREATE INDEX IF NOT EXISTS idx_conversations_contact ON conversations(contact_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_workspace ON conversations(workspace_id, last_message_at);
    `,
  },
  {
    version: 2,
    up: `
      ALTER TABLE contacts ADD COLUMN notes TEXT;
    `,
  },
];

export interface OrbitDb {
  readonly db: DatabaseSync;
  readonly schemaVersion: number;
  transaction<T>(fn: () => T): T;
  insertContact(contact: Contact): void;
  getContact(workspaceId: string, id: string): Contact | undefined;
  searchContacts(
    workspaceId: string,
    query: string,
    limit?: number,
  ): Contact[];
  countContacts(workspaceId: string): number;
  insertConversation(conversation: Conversation): void;
  getConversation(workspaceId: string, id: string): Conversation | undefined;
  countConversations(workspaceId: string): number;
  close(): void;
}

function parseTags(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((t): t is string => typeof t === "string")
      : [];
  } catch {
    return [];
  }
}

function rowToContact(row: Record<string, unknown>): Contact {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    name: String(row.name),
    email:
      row.email === null || row.email === undefined
        ? undefined
        : String(row.email),
    phone:
      row.phone === null || row.phone === undefined
        ? undefined
        : String(row.phone),
    tags: parseTags(row.tags),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function rowToConversation(row: Record<string, unknown>): Conversation {
  const status = String(row.status);
  if (status !== "open" && status !== "closed" && status !== "archived") {
    throw new Error(`invalid conversation status: ${status}`);
  }
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    contactId: String(row.contact_id),
    channel: String(row.channel),
    lastMessageAt: String(row.last_message_at),
    status,
    createdAt: String(row.created_at),
  };
}

function getSchemaVersion(db: DatabaseSync): number {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
  const row = db
    .prepare("SELECT MAX(version) AS v FROM schema_migrations")
    .get() as { v: number | null } | undefined;
  return row?.v ?? 0;
}

function applyMigrations(db: DatabaseSync): number {
  const current = getSchemaVersion(db);
  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    db.exec("BEGIN");
    try {
      db.exec(migration.up);
      db.prepare(
        "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
      ).run(migration.version, new Date().toISOString());
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw new Error(
        `migration ${migration.version} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  return getSchemaVersion(db);
}

export function openDb(path: string): OrbitDb {
  const db = new DatabaseSync(path);
  let schemaVersion: number;
  try {
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA synchronous = NORMAL;");
    db.exec("PRAGMA foreign_keys = ON;");
    schemaVersion = applyMigrations(db);
  } catch (err) {
    db.close();
    throw err;
  }

  const insertContactStmt: StatementSync = db.prepare(`
    INSERT INTO contacts (id, workspace_id, name, email, phone, tags, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      email = excluded.email,
      phone = excluded.phone,
      tags = excluded.tags,
      updated_at = excluded.updated_at
  `);
  const getContactStmt: StatementSync = db.prepare(`
    SELECT * FROM contacts WHERE workspace_id = ? AND id = ?
  `);
  const searchStmt: StatementSync = db.prepare(`
    SELECT * FROM contacts
    WHERE workspace_id = ?
      AND (name LIKE ? OR email LIKE ? OR phone LIKE ? OR tags LIKE ?)
    ORDER BY name
    LIMIT ?
  `);
  const countContactsStmt: StatementSync = db.prepare(
    "SELECT COUNT(*) AS c FROM contacts WHERE workspace_id = ?",
  );
  const insertConversationStmt: StatementSync = db.prepare(`
    INSERT INTO conversations (id, workspace_id, contact_id, channel, last_message_at, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      channel = excluded.channel,
      last_message_at = excluded.last_message_at,
      status = excluded.status
  `);
  const getConversationStmt: StatementSync = db.prepare(`
    SELECT * FROM conversations WHERE workspace_id = ? AND id = ?
  `);
  const countConversationsStmt: StatementSync = db.prepare(
    "SELECT COUNT(*) AS c FROM conversations WHERE workspace_id = ?",
  );

  return {
    db,
    schemaVersion,
    transaction<T>(fn: () => T): T {
      db.exec("BEGIN");
      try {
        const result = fn();
        db.exec("COMMIT");
        return result;
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
    },
    insertContact(contact) {
      insertContactStmt.run(
        contact.id,
        contact.workspaceId,
        contact.name,
        contact.email ?? null,
        contact.phone ?? null,
        JSON.stringify(contact.tags),
        contact.createdAt,
        contact.updatedAt,
      );
    },
    getContact(workspaceId, id) {
      const row = getContactStmt.get(workspaceId, id) as
        | Record<string, unknown>
        | undefined;
      return row ? rowToContact(row) : undefined;
    },
    searchContacts(workspaceId, query, limit = 50) {
      const pattern = `%${query}%`;
      const rows = searchStmt.all(
        workspaceId,
        pattern,
        pattern,
        pattern,
        pattern,
        limit,
      ) as Record<string, unknown>[];
      return rows.map(rowToContact);
    },
    countContacts(workspaceId) {
      const row = countContactsStmt.get(workspaceId) as { c: number };
      return Number(row.c);
    },
    insertConversation(conversation) {
      insertConversationStmt.run(
        conversation.id,
        conversation.workspaceId,
        conversation.contactId,
        conversation.channel,
        conversation.lastMessageAt,
        conversation.status,
        conversation.createdAt,
      );
    },
    getConversation(workspaceId, id) {
      const row = getConversationStmt.get(workspaceId, id) as
        | Record<string, unknown>
        | undefined;
      return row ? rowToConversation(row) : undefined;
    },
    countConversations(workspaceId) {
      const row = countConversationsStmt.get(workspaceId) as { c: number };
      return Number(row.c);
    },
    close() {
      db.close();
    },
  };
}
