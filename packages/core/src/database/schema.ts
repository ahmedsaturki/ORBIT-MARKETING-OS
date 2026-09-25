export const DATABASE_SCHEMA_VERSION = 12;

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


CREATE TABLE IF NOT EXISTS marketing_objectives (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default' REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  metric TEXT NOT NULL,
  target REAL NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_marketing_objectives_workspace
  ON marketing_objectives(workspace_id, status, period_end);

CREATE TABLE IF NOT EXISTS strategy_documents (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default' REFERENCES workspaces(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK(version >= 1),
  objective_ids_json TEXT NOT NULL DEFAULT '[]',
  audience_ids_json TEXT NOT NULL DEFAULT '[]',
  offer_ids_json TEXT NOT NULL DEFAULT '[]',
  positioning TEXT NOT NULL,
  key_messages_json TEXT NOT NULL DEFAULT '[]',
  content_pillars_json TEXT NOT NULL DEFAULT '[]',
  channels_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_strategy_documents_workspace
  ON strategy_documents(workspace_id, status, updated_at);

CREATE TABLE IF NOT EXISTS audiences (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default' REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  attributes_json TEXT NOT NULL DEFAULT '{}',
  exclusions_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audiences_workspace
  ON audiences(workspace_id, updated_at);

CREATE TABLE IF NOT EXISTS offers (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default' REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  promise TEXT NOT NULL,
  proof_points_json TEXT NOT NULL DEFAULT '[]',
  constraints_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_offers_workspace
  ON offers(workspace_id, updated_at);

CREATE TABLE IF NOT EXISTS knowledge_sources (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default' REFERENCES workspaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  locator TEXT,
  collected_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_knowledge_sources_workspace
  ON knowledge_sources(workspace_id, collected_at);

CREATE TABLE IF NOT EXISTS knowledge_items (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default' REFERENCES workspaces(id) ON DELETE CASCADE,
  statement TEXT NOT NULL,
  source_ids_json TEXT NOT NULL DEFAULT '[]',
  trust TEXT NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]',
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_knowledge_items_workspace_trust
  ON knowledge_items(workspace_id, trust, updated_at);

CREATE TABLE IF NOT EXISTS knowledge_evidence (
  item_id TEXT NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  excerpt_hash TEXT NOT NULL,
  collected_at TEXT NOT NULL,
  PRIMARY KEY(item_id, source_id, excerpt_hash)
);

CREATE TABLE IF NOT EXISTS agent_definitions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default' REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  goal TEXT NOT NULL,
  autonomy TEXT NOT NULL,
  tool_grants_json TEXT NOT NULL DEFAULT '[]',
  knowledge_scope_json TEXT NOT NULL DEFAULT '[]',
  max_steps INTEGER NOT NULL CHECK(max_steps > 0),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_definitions_workspace
  ON agent_definitions(workspace_id, enabled, role);

CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agent_definitions(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL DEFAULT 'default' REFERENCES workspaces(id) ON DELETE CASCADE,
  input TEXT NOT NULL,
  status TEXT NOT NULL,
  step_count INTEGER NOT NULL DEFAULT 0 CHECK(step_count >= 0),
  started_at TEXT,
  completed_at TEXT,
  blocked_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_workspace_status
  ON agent_runs(workspace_id, status, started_at);

CREATE TABLE IF NOT EXISTS marketing_policies (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default' REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mode TEXT NOT NULL,
  allowed_actions_json TEXT NOT NULL DEFAULT '[]',
  blocked_actions_json TEXT NOT NULL DEFAULT '[]',
  max_daily_external_actions INTEGER NOT NULL CHECK(max_daily_external_actions >= 0),
  require_approval_for_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_marketing_policies_workspace
  ON marketing_policies(workspace_id, updated_at);

CREATE TABLE IF NOT EXISTS work_items (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default' REFERENCES workspaces(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  owner_id TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  due_at TEXT,
  source_id TEXT,
  target_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_work_items_workspace_status
  ON work_items(workspace_id, status, priority, due_at);

CREATE TABLE IF NOT EXISTS work_dependencies (
  workspace_id TEXT NOT NULL DEFAULT 'default' REFERENCES workspaces(id) ON DELETE CASCADE,
  predecessor_id TEXT NOT NULL,
  successor_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  PRIMARY KEY(workspace_id, predecessor_id, successor_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_work_dependencies_successor
  ON work_dependencies(workspace_id, successor_id, kind);

CREATE TABLE IF NOT EXISTS operational_links (
  workspace_id TEXT NOT NULL DEFAULT 'default' REFERENCES workspaces(id) ON DELETE CASCADE,
  from_type TEXT NOT NULL,
  from_id TEXT NOT NULL,
  to_type TEXT NOT NULL,
  to_id TEXT NOT NULL,
  relation TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(workspace_id, from_type, from_id, to_type, to_id, relation)
);

CREATE INDEX IF NOT EXISTS idx_operational_links_from
  ON operational_links(workspace_id, from_type, from_id);

CREATE INDEX IF NOT EXISTS idx_operational_links_to
  ON operational_links(workspace_id, to_type, to_id);

CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default' REFERENCES workspaces(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  stage TEXT NOT NULL CHECK(stage IN ('new', 'qualified', 'proposal', 'negotiation', 'won', 'lost', 'nurture')),
  value REAL NOT NULL CHECK(value >= 0),
  currency TEXT NOT NULL CHECK(length(currency) = 3 AND currency = upper(currency)),
  probability REAL NOT NULL CHECK(probability >= 0 AND probability <= 100),
  source TEXT,
  owner_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_opportunities_workspace_stage
  ON opportunities(workspace_id, stage, updated_at);

CREATE INDEX IF NOT EXISTS idx_opportunities_workspace_contact
  ON opportunities(workspace_id, contact_id, updated_at);

CREATE TABLE IF NOT EXISTS insights (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default' REFERENCES workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('performance', 'anomaly', 'learning', 'trend', 'recommendation')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  metric TEXT,
  value REAL,
  confidence REAL NOT NULL CHECK(confidence >= 0 AND confidence <= 1),
  source_ids_json TEXT NOT NULL DEFAULT '[]',
  observed_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_insights_workspace_kind
  ON insights(workspace_id, kind, observed_at);

CREATE INDEX IF NOT EXISTS idx_insights_workspace_updated
  ON insights(workspace_id, updated_at);

PRAGMA user_version = 12;

`;
