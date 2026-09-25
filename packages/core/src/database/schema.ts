export const DATABASE_SCHEMA_VERSION = 11;

export const DATABASE_SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runtime_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_memberships (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_memberships_user
  ON workspace_memberships(user_id, workspace_id, active);

CREATE TABLE IF NOT EXISTS vault_records (
  workspace_id TEXT NOT NULL DEFAULT 'default' REFERENCES workspaces(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, label)
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  platform TEXT NOT NULL,
  display_name TEXT NOT NULL,
  username TEXT,
  status TEXT NOT NULL,
  session_payload_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS content_items (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  approval_status TEXT NOT NULL DEFAULT 'draft',
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

CREATE TABLE IF NOT EXISTS campaign_content (
  workspace_id TEXT NOT NULL DEFAULT 'default',
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE RESTRICT,
  PRIMARY KEY (campaign_id, content_id)
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  content_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  requested_by TEXT NOT NULL,
  reviewer_ids_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL,
  decided_by TEXT,
  decided_at TEXT,
  note TEXT
);

CREATE TABLE IF NOT EXISTS campaign_accounts (
  workspace_id TEXT NOT NULL DEFAULT 'default',
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  PRIMARY KEY (campaign_id, account_id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  content_id TEXT REFERENCES content_items(id) ON DELETE RESTRICT,
  destination_id TEXT,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  platform TEXT NOT NULL,
  kind TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  available_at TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(workspace_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  display_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  source_platform TEXT,
  status TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_ready
  ON tasks(status, available_at, priority);

CREATE TABLE IF NOT EXISTS execution_counters (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  day_key INTEGER NOT NULL,
  completed_today INTEGER NOT NULL DEFAULT 0 CHECK(completed_today >= 0),
  consecutive_failures INTEGER NOT NULL DEFAULT 0 CHECK(consecutive_failures >= 0),
  PRIMARY KEY (workspace_id, account_id)
);

CREATE INDEX IF NOT EXISTS idx_execution_counters_day
  ON execution_counters(workspace_id, day_key);

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default' REFERENCES workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK(size_bytes > 0),
  sha256 TEXT,
  local_path TEXT NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_media_assets_workspace_updated
  ON media_assets(workspace_id, updated_at);

CREATE TABLE IF NOT EXISTS automation_rule_packs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default' REFERENCES workspaces(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  version TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  rules_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(workspace_id, platform, id)
);

CREATE INDEX IF NOT EXISTS idx_rule_packs_workspace_platform
  ON automation_rule_packs(workspace_id, platform, enabled);


CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  account_id TEXT,
  contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  external_thread_id TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(workspace_id, account_id, external_thread_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  external_message_id TEXT,
  direction TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_messages_external
  ON messages(conversation_id, external_message_id);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
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

CREATE INDEX IF NOT EXISTS idx_contacts_updated
  ON contacts(updated_at);

CREATE INDEX IF NOT EXISTS idx_conversations_updated
  ON conversations(updated_at);

CREATE INDEX IF NOT EXISTS idx_messages_thread
  ON messages(conversation_id, sent_at);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp
  ON audit_events(timestamp);

`;
