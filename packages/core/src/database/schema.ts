export const DATABASE_SCHEMA_VERSION = 5;

export const DATABASE_SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  display_name TEXT NOT NULL,
  username TEXT,
  status TEXT NOT NULL,
  health_score INTEGER NOT NULL DEFAULT 100 CHECK (health_score BETWEEN 0 AND 100),
  created_at TEXT NOT NULL,
  last_activity_at TEXT
);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS content_items (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  approval_status TEXT NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS content_variants (
  content_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  body TEXT,
  PRIMARY KEY (content_id, platform)
);

CREATE TABLE IF NOT EXISTS campaign_accounts (
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  content_id TEXT REFERENCES content_items(id) ON DELETE RESTRICT,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  PRIMARY KEY (campaign_id, account_id)
);

CREATE TABLE IF NOT EXISTS campaign_content (
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE RESTRICT,
  PRIMARY KEY (campaign_id, content_id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  content_id TEXT REFERENCES content_items(id) ON DELETE RESTRICT,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  platform TEXT NOT NULL,
  kind TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts >= 1),
  available_at TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  requested_by TEXT NOT NULL,
  reviewer_ids_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL,
  decided_by TEXT,
  decided_at TEXT,
  note TEXT
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  source_platform TEXT,
  status TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  external_thread_id TEXT NOT NULL,
  status TEXT NOT NULL,
  assignee_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(account_id, external_thread_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  external_message_id TEXT,
  direction TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  UNIQUE(conversation_id, external_message_id)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  timestamp TEXT NOT NULL,
  category TEXT NOT NULL,
  action TEXT NOT NULL,
  outcome TEXT NOT NULL,
  actor TEXT NOT NULL,
  entity_id TEXT,
  metadata_json TEXT,
  previous_hash TEXT NOT NULL DEFAULT 'GENESIS',
  hash TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_accounts_workspace ON accounts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_workspace ON campaigns(workspace_id);
CREATE INDEX IF NOT EXISTS idx_content_workspace ON content_items(workspace_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_tasks_available ON tasks(status, available_at, priority);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON tasks(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_contacts_workspace_status ON contacts(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_workspace_status ON conversations(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_workspace_time ON audit_events(workspace_id, timestamp);
`;
