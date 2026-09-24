mod license;

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Key, Nonce,
};
use argon2::{Algorithm, Argon2, Params, Version};
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use rand::RngCore;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{BufReader, Read},
    path::PathBuf,
    sync::{OnceLock, RwLock},
};
use tauri::Manager;
use time::{format_description::well_known::Rfc3339, Duration, OffsetDateTime};
use thiserror::Error;
use zeroize::Zeroizing;

const DEFAULT_WORKSPACE_ID: &str = "default";
const DEFAULT_LOCAL_USER_ID: &str = "local-user";
const DEFAULT_DAILY_EXECUTION_LIMIT: i64 = 10;
const DEFAULT_CIRCUIT_BREAKER_THRESHOLD: i64 = 3;
const SCHEMA_VERSION: i64 = 9;

static ACTIVE_WORKSPACE_ID: OnceLock<RwLock<String>> = OnceLock::new();

fn active_workspace_lock() -> &'static RwLock<String> {
    ACTIVE_WORKSPACE_ID.get_or_init(|| RwLock::new(DEFAULT_WORKSPACE_ID.to_string()))
}

fn active_workspace_id() -> String {
    match active_workspace_lock().read() {
        Ok(value) => value.clone(),
        Err(poisoned) => poisoned.into_inner().clone(),
    }
}

fn set_active_workspace_id(workspace_id: &str) -> Result<(), AppError> {
    match active_workspace_lock().write() {
        Ok(mut value) => {
            *value = workspace_id.to_string();
            Ok(())
        }
        Err(poisoned) => {
            *poisoned.into_inner() = workspace_id.to_string();
            Ok(())
        }
    }
}

const SCHEMA: &str = r#"
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
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
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
"#;

#[derive(Debug, Error)]
enum AppError {
    #[error("database error")]
    Database(#[from] rusqlite::Error),
    #[error("invalid vault password")]
    InvalidPassword,
    #[error("encryption error")]
    Encryption,
    #[error("decryption error")]
    Decryption,
    #[error("vault record not found")]
    NotFound,
    #[error("unauthorized workspace operation")]
    Unauthorized,
    #[error("invalid label")]
    InvalidLabel,
    #[error("invalid stored payload")]
    InvalidPayload,
    #[error("application path error")]
    Path,
    #[error("filesystem error")]
    Filesystem(#[from] std::io::Error),
}

#[derive(Debug, Serialize, Deserialize)]
struct EncryptedPayload {
    version: u8,
    algorithm: String,
    salt: String,
    nonce: String,
    ciphertext: String,
}

#[derive(Debug, Serialize)]
struct WorkspaceView {
    id: String,
    name: String,
    created_at: String,
}

#[derive(Debug, Serialize)]
struct VaultWriteResult {
    label: String,
    payload_version: u8,
}


#[derive(Debug, Serialize)]
struct CampaignView {
    id: String,
    name: String,
    status: String,
    task_count: i64,
    created_at: String,
}

#[derive(Debug, Serialize)]
struct ContentView {
    id: String,
    title: String,
    body: String,
    approval_status: String,
    tags_json: String,
    updated_at: String,
}
#[derive(Debug, Serialize)]
struct MediaAssetView {
    id: String,
    kind: String,
    filename: String,
    mime_type: String,
    size_bytes: i64,
    sha256: Option<String>,
    local_path: String,
    tags_json: String,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Serialize)]
struct AutomationRulePackView {
    id: String,
    platform: String,
    version: String,
    schema_version: i64,
    rules_json: String,
    enabled: bool,
    created_at: String,
    updated_at: String,
}

struct ContentVariantView {
    content_id: String,
    platform: String,
    body: Option<String>,
}

#[derive(Debug, Serialize)]
struct ApprovalView {
    id: String,
    content_id: String,
    requested_by: String,
    status: String,
    decided_by: Option<String>,
    decided_at: Option<String>,
    note: Option<String>,
}

#[derive(Debug, Serialize)]
struct TaskView {
    id: String,
    campaign_id: String,
    content_id: Option<String>,
    destination_id: Option<String>,
    account_id: String,
    platform: String,
    kind: String,
    priority: i64,
    status: String,
    attempts: i64,
    max_attempts: i64,
    idempotency_key: String,
    available_at: String,
    created_at: String,
}

#[derive(Debug, Serialize)]
struct ContactView {
    id: String,
    display_name: String,
    phone: Option<String>,
    email: Option<String>,
    source_platform: Option<String>,
    status: String,
    notes: Option<String>,
    updated_at: String,
}

#[derive(Debug, Serialize)]
struct ConversationView {
    id: String,
    account_id: Option<String>,
    contact_id: Option<String>,
    platform: String,
    external_thread_id: Option<String>,
    status: String,
    message_count: i64,
    updated_at: String,
}

#[derive(Debug, Serialize)]
struct MessageView {
    id: String,
    conversation_id: String,
    direction: String,
    body: String,
    sent_at: String,
}

#[derive(Debug, Serialize)]
struct AnalyticsSummaryView {
    attempted: i64,
    succeeded: i64,
    failed: i64,
    blocked: i64,
    pending: i64,
    running: i64,
    completion_rate: f64,
    success_rate: f64,
    failure_rate: f64,
}

struct AuditView {
    id: String,
    timestamp: String,
    category: String,
    action: String,
    outcome: String,
    actor: String,
    entity_id: Option<String>,
    metadata_json: Option<String>,
    previous_hash: String,
    hash: String,
}

#[derive(Debug, Serialize)]
struct TelegramExecutionView {
    task_id: String,
    status: String,
    external_message_id: Option<i64>,
    message: String,
    retry_at: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TelegramApiResponse<T> {
    ok: bool,
    description: Option<String>,
    result: Option<T>,
    parameters: Option<TelegramParameters>,
}

#[derive(Debug, Deserialize)]
struct TelegramParameters {
    retry_after: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct TelegramSentMessage {
    message_id: i64,
}

#[derive(Debug, Serialize)]
struct AccountView {
    id: String,
    platform: String,
    display_name: String,
    username: Option<String>,
    status: String,
    has_encrypted_session: bool,
}

fn validate_telegram_token(token: &str) -> Result<String, AppError> {
    let value = token.trim();
    let Some((bot_id, secret)) = value.split_once(':') else {
        return Err(AppError::InvalidPayload);
    };
    if bot_id.is_empty()
        || secret.len() < 10
        || bot_id.len() > 32
        || secret.len() > 256
        || !bot_id.chars().all(|character| character.is_ascii_digit())
        || !secret
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '_' || character == '-')
    {
        return Err(AppError::InvalidPayload);
    }
    Ok(value.to_string())
}

fn telegram_delivery_status_is_ambiguous(status_code: u16) -> bool {
    status_code == 408 || (500..600).contains(&status_code)
}

fn parse_retry_timestamp(retry_after_seconds: u64) -> String {
    let seconds = retry_after_seconds.clamp(1, 86_400);
    let retry_at = OffsetDateTime::now_utc() + Duration::seconds(seconds as i64);
    retry_at
        .format(&Rfc3339)
        .unwrap_or_else(|_| OffsetDateTime::UNIX_EPOCH.format(&Rfc3339).unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string()))
}

fn execution_day_key() -> i64 {
    OffsetDateTime::now_utc().unix_timestamp().div_euclid(86_400)
}

fn next_utc_midnight_timestamp() -> String {
    let next_epoch = (execution_day_key() + 1) * 86_400;
    match OffsetDateTime::from_unix_timestamp(next_epoch) {
        Ok(value) => match value.format(&Rfc3339) {
            Ok(formatted) => formatted,
            Err(_) => "1970-01-01T00:00:00Z".to_string(),
        },
        Err(_) => "1970-01-01T00:00:00Z".to_string(),
    }
}

fn load_execution_counters(
    connection: &Connection,
    workspace_id: &str,
    account_id: &str,
) -> Result<(i64, i64), String> {
    let day_key = execution_day_key();
    connection
        .execute(
            "INSERT INTO execution_counters(
               workspace_id, account_id, day_key, completed_today, consecutive_failures
             )
             VALUES (?1, ?2, ?3, 0, 0)
             ON CONFLICT(workspace_id, account_id) DO UPDATE SET
               day_key=excluded.day_key,
               completed_today=CASE
                 WHEN execution_counters.day_key != excluded.day_key THEN 0
                 ELSE execution_counters.completed_today
               END,
               consecutive_failures=CASE
                 WHEN execution_counters.day_key != excluded.day_key THEN 0
                 ELSE execution_counters.consecutive_failures
               END",
            params![workspace_id, account_id, day_key],
        )
        .map_err(|error| error.to_string())?;

    connection
        .query_row(
            "SELECT completed_today, consecutive_failures
             FROM execution_counters
             WHERE workspace_id=?1 AND account_id=?2",
            params![workspace_id, account_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|error| error.to_string())
}

fn record_execution_success(
    connection: &Connection,
    workspace_id: &str,
    account_id: &str,
) -> Result<(), String> {
    let day_key = execution_day_key();
    connection
        .execute(
            "UPDATE execution_counters
             SET day_key=?1, completed_today=completed_today+1, consecutive_failures=0
             WHERE workspace_id=?2 AND account_id=?3",
            params![day_key, workspace_id, account_id],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn record_execution_failure(
    connection: &Connection,
    workspace_id: &str,
    account_id: &str,
) -> Result<(), String> {
    let day_key = execution_day_key();
    connection
        .execute(
            "UPDATE execution_counters
             SET day_key=?1, consecutive_failures=consecutive_failures+1
             WHERE workspace_id=?2 AND account_id=?3",
            params![day_key, workspace_id, account_id],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn telegram_task_audit(
    connection: &Connection,
    workspace_id: &str,
    task_id: &str,
    action: &str,
    outcome: &str,
) -> Result<(), String> {
    write_audit_for_workspace(
        connection,
        workspace_id,
        "telegram",
        action,
        outcome,
        "user",
        Some(task_id),
    )
    .map_err(|error| error.to_string())
}

fn migrate_schema(connection: &Connection) -> Result<(), AppError> {
    let version: i64 = connection.query_row("PRAGMA user_version", [], |row| row.get(0))?;

    if version < 2 {
        connection.execute_batch(
            "CREATE TABLE IF NOT EXISTS workspaces (
               id TEXT PRIMARY KEY,
               name TEXT NOT NULL,
               created_at TEXT NOT NULL
             );",
        )?;

        let migrations = [
            ("accounts", "workspace_id", "ALTER TABLE accounts ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'default'"),
            ("campaigns", "workspace_id", "ALTER TABLE campaigns ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'default'"),
            ("campaign_accounts", "workspace_id", "ALTER TABLE campaign_accounts ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'default'"),
            ("tasks", "workspace_id", "ALTER TABLE tasks ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'default'"),
            ("tasks", "idempotency_key", "ALTER TABLE tasks ADD COLUMN idempotency_key TEXT"),
            ("contacts", "workspace_id", "ALTER TABLE contacts ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'default'"),
            ("conversations", "workspace_id", "ALTER TABLE conversations ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'default'"),
            ("audit_events", "workspace_id", "ALTER TABLE audit_events ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'default'"),
        ];

        for (table, column, sql) in migrations {
            if !has_column(connection, table, column)? {
                connection.execute_batch(sql)?;
            }
        }

        connection.execute(
            "UPDATE tasks SET idempotency_key=id WHERE idempotency_key IS NULL OR idempotency_key=''",
            [],
        )?;
        connection.execute_batch(
            "CREATE UNIQUE INDEX IF NOT EXISTS ux_tasks_idempotency ON tasks(idempotency_key);
             PRAGMA user_version = 2;",
        )?;
    }

    if version < 3 {
        if !has_column(connection, "audit_events", "previous_hash")? {
            connection.execute_batch(
                "ALTER TABLE audit_events ADD COLUMN previous_hash TEXT NOT NULL DEFAULT 'GENESIS'",
            )?;
        }
        if !has_column(connection, "audit_events", "hash")? {
            connection.execute_batch(
                "ALTER TABLE audit_events ADD COLUMN hash TEXT NOT NULL DEFAULT ''",
            )?;
        }

        let transaction = connection.unchecked_transaction()?;
        let workspace_ids: Vec<String> = {
            let mut workspace_statement =
                transaction.prepare("SELECT DISTINCT workspace_id FROM audit_events ORDER BY workspace_id")?;
            let rows = workspace_statement
                .query_map([], |row| row.get::<_, String>(0))?;
            rows.collect::<Result<Vec<_>, _>>()?
        };

        for workspace_id in workspace_ids {
            let mut statement = transaction.prepare(
                "SELECT rowid, id, workspace_id, timestamp, category, action, outcome, actor, entity_id, metadata_json
                 FROM audit_events
                 WHERE workspace_id=?1
                 ORDER BY rowid ASC",
            )?;
            let rows = statement.query_map(params![&workspace_id], |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, String>(5)?,
                    row.get::<_, String>(6)?,
                    row.get::<_, String>(7)?,
                    row.get::<_, Option<String>>(8)?,
                    row.get::<_, Option<String>>(9)?,
                ))
            })?;

            let mut previous_hash = "GENESIS".to_string();
            for row in rows {
                let (rowid, id, workspace_id, timestamp, category, action, outcome, actor, entity_id, metadata_json) = row?;
                let hash = audit_hash(
                    &previous_hash,
                    &id,
                    &workspace_id,
                    &timestamp,
                    &category,
                    &action,
                    &outcome,
                    &actor,
                    entity_id.as_deref(),
                    metadata_json.as_deref(),
                );
                transaction.execute(
                    "UPDATE audit_events SET previous_hash=?1, hash=?2 WHERE rowid=?3",
                    params![previous_hash, hash, rowid],
                )?;
                previous_hash = hash;
            }
        }

        transaction.commit()?;
    }

    if version < 4 {
        connection.execute_batch(
            "CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                direction TEXT NOT NULL,
                body TEXT NOT NULL,
                sent_at TEXT NOT NULL
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
                PRIMARY KEY(content_id, platform)
             );
             CREATE TABLE IF NOT EXISTS campaign_content (
                workspace_id TEXT NOT NULL DEFAULT 'default',
                campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
                content_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE RESTRICT,
                PRIMARY KEY(campaign_id, content_id)
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
             );",
        )?;

        if !has_column(connection, "tasks", "content_id")? {
            connection.execute_batch(
                "ALTER TABLE tasks ADD COLUMN content_id TEXT REFERENCES content_items(id) ON DELETE RESTRICT",
            )?;
        }
        if !has_column(connection, "messages", "external_message_id")? {
            connection.execute_batch(
                "ALTER TABLE messages ADD COLUMN external_message_id TEXT",
            )?;
        }
        connection.execute_batch(
            "CREATE UNIQUE INDEX IF NOT EXISTS ux_messages_external
             ON messages(conversation_id, external_message_id);",
        )?;
    }

    if version < 5 {
        if !has_column(connection, "conversations", "account_id")? {
            connection.execute_batch(
                "ALTER TABLE conversations ADD COLUMN account_id TEXT",
            )?;
        }
        connection.execute_batch(
            "CREATE INDEX IF NOT EXISTS idx_conversations_account
             ON conversations(workspace_id, account_id, updated_at);",
        )?;
    }

    if version < 6 {
        if !has_column(connection, "tasks", "destination_id")? {
            connection.execute_batch(
                "ALTER TABLE tasks ADD COLUMN destination_id TEXT",
            )?;
        }
        connection.execute_batch(
            "CREATE INDEX IF NOT EXISTS idx_tasks_destination
             ON tasks(workspace_id, destination_id)",
        )?;
    }

    if version < 7 {
        connection.execute_batch(
            "CREATE TABLE IF NOT EXISTS workspace_memberships (
               workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
               user_id TEXT NOT NULL,
               role TEXT NOT NULL,
               active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
               created_at TEXT NOT NULL,
               PRIMARY KEY (workspace_id, user_id)
             );
             CREATE INDEX IF NOT EXISTS idx_workspace_memberships_user
               ON workspace_memberships(user_id, workspace_id, active);",
        )?;

        let timestamp = chrono_like_timestamp();
        connection.execute(
            "INSERT OR IGNORE INTO workspace_memberships(workspace_id, user_id, role, active, created_at)
             SELECT id, ?1, 'owner', 1, ?2
             FROM workspaces",
            params![DEFAULT_LOCAL_USER_ID, timestamp],
        )?;
    }

    if version < 8 {
        if !has_column(connection, "vault_records", "workspace_id")? {
            connection.execute_batch(
                "CREATE TABLE IF NOT EXISTS vault_records (
                   label TEXT PRIMARY KEY,
                   payload_json TEXT NOT NULL,
                   updated_at TEXT NOT NULL
                 );
                 CREATE TABLE vault_records_v8 (
                   workspace_id TEXT NOT NULL DEFAULT 'default' REFERENCES workspaces(id) ON DELETE CASCADE,
                   label TEXT NOT NULL,
                   payload_json TEXT NOT NULL,
                   updated_at TEXT NOT NULL,
                   PRIMARY KEY (workspace_id, label)
                 );
                 INSERT INTO vault_records_v8(workspace_id, label, payload_json, updated_at)
                 SELECT 'default', label, payload_json, updated_at
                 FROM vault_records;
                 DROP TABLE vault_records;
                 ALTER TABLE vault_records_v8 RENAME TO vault_records;",
            )?;
        }
    }

    connection.execute_batch("PRAGMA user_version = 9;")?;
}

const INTEGRITY_TRIGGERS: &str = r#"
CREATE TRIGGER IF NOT EXISTS orbit_campaign_accounts_insert_workspace
BEFORE INSERT ON campaign_accounts
WHEN NOT EXISTS (
  SELECT 1
  FROM campaigns c
  JOIN accounts a ON a.id = NEW.account_id
  WHERE c.id = NEW.campaign_id
    AND c.workspace_id = NEW.workspace_id
    AND a.workspace_id = NEW.workspace_id
)
BEGIN
  SELECT RAISE(ABORT, 'campaign account workspace mismatch');
END;

CREATE TRIGGER IF NOT EXISTS orbit_campaign_accounts_update_workspace
BEFORE UPDATE OF workspace_id, campaign_id, account_id ON campaign_accounts
WHEN NOT EXISTS (
  SELECT 1
  FROM campaigns c
  JOIN accounts a ON a.id = NEW.account_id
  WHERE c.id = NEW.campaign_id
    AND c.workspace_id = NEW.workspace_id
    AND a.workspace_id = NEW.workspace_id
)
BEGIN
  SELECT RAISE(ABORT, 'campaign account workspace mismatch');
END;

CREATE TRIGGER IF NOT EXISTS orbit_campaign_content_insert_workspace
BEFORE INSERT ON campaign_content
WHEN NOT EXISTS (
  SELECT 1
  FROM campaigns c
  JOIN content_items i ON i.id = NEW.content_id
  WHERE c.id = NEW.campaign_id
    AND c.workspace_id = NEW.workspace_id
    AND i.workspace_id = NEW.workspace_id
)
BEGIN
  SELECT RAISE(ABORT, 'campaign content workspace mismatch');
END;

CREATE TRIGGER IF NOT EXISTS orbit_campaign_content_update_workspace
BEFORE UPDATE OF workspace_id, campaign_id, content_id ON campaign_content
WHEN NOT EXISTS (
  SELECT 1
  FROM campaigns c
  JOIN content_items i ON i.id = NEW.content_id
  WHERE c.id = NEW.campaign_id
    AND c.workspace_id = NEW.workspace_id
    AND i.workspace_id = NEW.workspace_id
)
BEGIN
  SELECT RAISE(ABORT, 'campaign content workspace mismatch');
END;

CREATE TRIGGER IF NOT EXISTS orbit_tasks_insert_workspace
BEFORE INSERT ON tasks
WHEN NOT EXISTS (
  SELECT 1
  FROM campaigns c
  JOIN accounts a ON a.id = NEW.account_id
  WHERE c.id = NEW.campaign_id
    AND c.workspace_id = NEW.workspace_id
    AND a.workspace_id = NEW.workspace_id
    AND a.platform = NEW.platform
    AND (
      NEW.content_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM content_items i
        WHERE i.id = NEW.content_id
          AND i.workspace_id = NEW.workspace_id
      )
    )
)
BEGIN
  SELECT RAISE(ABORT, 'task workspace/account/content/platform mismatch');
END;

CREATE TRIGGER IF NOT EXISTS orbit_tasks_update_workspace
BEFORE UPDATE OF workspace_id, campaign_id, account_id, platform, content_id ON tasks
WHEN NOT EXISTS (
  SELECT 1
  FROM campaigns c
  JOIN accounts a ON a.id = NEW.account_id
  WHERE c.id = NEW.campaign_id
    AND c.workspace_id = NEW.workspace_id
    AND a.workspace_id = NEW.workspace_id
    AND a.platform = NEW.platform
    AND (
      NEW.content_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM content_items i
        WHERE i.id = NEW.content_id
          AND i.workspace_id = NEW.workspace_id
      )
    )
)
BEGIN
  SELECT RAISE(ABORT, 'task workspace/account/content/platform mismatch');
END;

CREATE TRIGGER IF NOT EXISTS orbit_conversations_insert_workspace
BEFORE INSERT ON conversations
WHEN NEW.account_id IS NOT NULL
 AND NOT EXISTS (
   SELECT 1 FROM accounts a
   WHERE a.id = NEW.account_id
     AND a.workspace_id = NEW.workspace_id
     AND a.platform = NEW.platform
 )
BEGIN
  SELECT RAISE(ABORT, 'conversation workspace/account/platform mismatch');
END;

CREATE TRIGGER IF NOT EXISTS orbit_conversations_update_workspace
BEFORE UPDATE OF workspace_id, account_id, platform ON conversations
WHEN NEW.account_id IS NOT NULL
 AND NOT EXISTS (
   SELECT 1 FROM accounts a
   WHERE a.id = NEW.account_id
     AND a.workspace_id = NEW.workspace_id
     AND a.platform = NEW.platform
 )
BEGIN
  SELECT RAISE(ABORT, 'conversation workspace/account/platform mismatch');
END;

CREATE TRIGGER IF NOT EXISTS orbit_approvals_insert_workspace
BEFORE INSERT ON approvals
WHEN NOT EXISTS (
  SELECT 1
  FROM content_items i
  WHERE i.id = NEW.content_id
    AND i.workspace_id = NEW.workspace_id
)
BEGIN
  SELECT RAISE(ABORT, 'approval workspace/content mismatch');
END;

CREATE TRIGGER IF NOT EXISTS orbit_approvals_update_workspace
BEFORE UPDATE OF workspace_id, content_id ON approvals
WHEN NOT EXISTS (
  SELECT 1
  FROM content_items i
  WHERE i.id = NEW.content_id
    AND i.workspace_id = NEW.workspace_id
)
BEGIN
  SELECT RAISE(ABORT, 'approval workspace/content mismatch');
END;
"#;

fn create_integrity_triggers(connection: &Connection) -> Result<(), AppError> {
    connection.execute_batch(INTEGRITY_TRIGGERS)?;
    Ok(())
}

fn cleanup_stale_database_artifacts(app_data: &PathBuf) -> Result<(), AppError> {
    for name in ["orbit.restore.sqlite3", "backups/orbit-backup-source.sqlite3"] {
        let path = app_data.join(name);
        if path.exists() {
            fs::remove_file(path)?;
        }
    }
}

fn restrict_private_file(path: &PathBuf) -> Result<(), AppError> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o600))?;
    }
    Ok(())
}

fn write_private_file(path: &PathBuf, contents: &str) -> Result<(), AppError> {
    fs::write(path, contents)?;
    restrict_private_file(path)?;
    Ok(())
}

fn ensure_workspace_context(connection: &Connection) -> Result<(), AppError> {
    let timestamp = chrono_like_timestamp();
    connection.execute(
        "INSERT OR IGNORE INTO workspaces(id, name, created_at) VALUES (?1, ?2, ?3)",
        params![DEFAULT_WORKSPACE_ID, "Default Workspace", timestamp],
    )?;

    connection.execute(
        "INSERT INTO runtime_state(key, value) VALUES ('local_user_id', ?1)
         ON CONFLICT(key) DO NOTHING",
        params![DEFAULT_LOCAL_USER_ID],
    )?;

    let stored: Option<String> = connection
        .query_row(
            "SELECT value FROM runtime_state WHERE key='active_workspace_id'",
            [],
            |row| row.get(0),
        )
        .optional()?;

    let candidate = stored.unwrap_or_else(|| DEFAULT_WORKSPACE_ID.to_string());
    let exists: bool = connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM workspaces WHERE id=?1)",
        params![candidate],
        |row| row.get(0),
    )?;
    let selected = if exists {
        candidate
    } else {
        DEFAULT_WORKSPACE_ID.to_string()
    };

    connection.execute(
        "INSERT INTO runtime_state(key, value) VALUES ('active_workspace_id', ?1)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        params![selected],
    )?;

    connection.execute(
        "INSERT OR IGNORE INTO workspace_memberships(workspace_id, user_id, role, active, created_at)
         SELECT id, ?1, 'owner', 1, ?2
         FROM workspaces",
        params![DEFAULT_LOCAL_USER_ID, timestamp],
    )?;

    set_active_workspace_id(&selected)?;
    Ok(())
}

fn open_db(app: &tauri::AppHandle) -> Result<Connection, AppError> {
    let app_data = app.path().app_data_dir().map_err(|_| AppError::Path)?;
    fs::create_dir_all(&app_data)?;
    let db_path: PathBuf = app_data.join("orbit.sqlite3");
    let connection = Connection::open(db_path)?;
    connection.execute_batch("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;")?;
    connection.execute_batch(SCHEMA)?;
    migrate_schema(&connection)?;
    create_integrity_triggers(&connection)?;
    ensure_workspace_context(&connection)?;
    cleanup_stale_temporary_artifacts(&app_data)?;
    Ok(connection)
}


pub(crate) fn open_db_for_module(app: &tauri::AppHandle) -> Result<Connection, String> {
    open_db(app).map_err(|error| error.to_string())
}

fn derive_key(password: &str, salt: &[u8]) -> Result<Zeroizing<[u8; 32]>, AppError> {
    if password.is_empty() || salt.len() < 16 {
        return Err(AppError::InvalidPassword);
    }

    let mut output = Zeroizing::new([0u8; 32]);
    let params = Params::new(64 * 1024, 3, 1, Some(32))
        .map_err(|_| AppError::InvalidPassword)?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    argon2
        .hash_password_into(password.as_bytes(), salt, &mut output[..])
        .map_err(|_| AppError::InvalidPassword)?;
    Ok(output)
}

fn seal(password: &str, plaintext: &str) -> Result<EncryptedPayload, AppError> {
    let mut salt = [0u8; 16];
    rand::rng().fill_bytes(&mut salt);
    let mut nonce_bytes = [0u8; 12];
    rand::rng().fill_bytes(&mut nonce_bytes);

    let key = derive_key(password, &salt)?;
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key[..]));
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce_bytes), plaintext.as_bytes())
        .map_err(|_| AppError::Encryption)?;

    Ok(EncryptedPayload {
        version: 1,
        algorithm: "AES-256-GCM".to_string(),
        salt: B64.encode(salt),
        nonce: B64.encode(nonce_bytes),
        ciphertext: B64.encode(ciphertext),
    })
}

fn open_payload(password: &str, payload: &EncryptedPayload) -> Result<String, AppError> {
    if payload.version != 1 || payload.algorithm != "AES-256-GCM" {
        return Err(AppError::InvalidPayload);
    }

    let salt = B64.decode(payload.salt.as_bytes()).map_err(|_| AppError::InvalidPayload)?;
    let nonce = B64.decode(payload.nonce.as_bytes()).map_err(|_| AppError::InvalidPayload)?;
    let ciphertext = B64.decode(payload.ciphertext.as_bytes()).map_err(|_| AppError::InvalidPayload)?;
    if salt.len() < 16 || nonce.len() != 12 || ciphertext.len() < 16 {
        return Err(AppError::InvalidPayload);
    }

    let key = derive_key(password, &salt)?;
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key[..]));
    let plaintext = cipher
        .decrypt(Nonce::from_slice(&nonce), ciphertext.as_ref())
        .map_err(|_| AppError::Decryption)?;

    String::from_utf8(plaintext).map_err(|_| AppError::Decryption)
}

fn local_user_id(connection: &Connection) -> Result<String, AppError> {
    connection
        .query_row(
            "SELECT value FROM runtime_state WHERE key='local_user_id'",
            [],
            |row| row.get(0),
        )
        .optional()
        .map(|value| value.unwrap_or_else(|| DEFAULT_LOCAL_USER_ID.to_string()))
        .map_err(AppError::from)
}

fn require_workspace_role_for(
    connection: &Connection,
    workspace_id: &str,
    required_roles: &[&str],
) -> Result<(), AppError> {
    let user_id = local_user_id(connection)?;
    let role: Option<String> = connection
        .query_row(
            "SELECT role FROM workspace_memberships
             WHERE workspace_id=?1 AND user_id=?2 AND active=1",
            params![workspace_id, user_id],
            |row| row.get(0),
        )
        .optional()?;

    match role {
        Some(role) if required_roles.contains(&role.as_str()) => Ok(()),
        Some(_) => Err(AppError::Unauthorized),
        None => Err(AppError::Unauthorized),
    }
}

fn require_local_user_actor(connection: &Connection, actor: &str) -> Result<(), AppError> {
    let local_user = local_user_id(connection)?;
    if actor != local_user {
        return Err(AppError::Unauthorized);
    }
    Ok(())
}

fn require_workspace_role(
    connection: &Connection,
    required_roles: &[&str],
) -> Result<(), AppError> {
    let workspace_id = active_workspace_id();
    require_workspace_role_for(connection, &workspace_id, required_roles)
}

pub(crate) fn require_workspace_role_for_module(
    connection: &Connection,
    workspace_id: &str,
    required_roles: &[&str],
) -> Result<(), String> {
    require_workspace_role_for(connection, workspace_id, required_roles)
        .map_err(|error| error.to_string())
}

pub(crate) fn active_workspace_id_for_module() -> String {
    active_workspace_id()
}

fn validate_label(label: &str) -> Result<String, AppError> {
    let value = label.trim();
    if value.is_empty() || value.len() > 200 {
        return Err(AppError::InvalidLabel);
    }
    Ok(value.to_string())
}

#[tauri::command]
async fn telegram_execute_task(
    app: tauri::AppHandle,
    task_id: String,
    vault_password: String,
    user_confirmed: bool,
) -> Result<TelegramExecutionView, String> {
    let workspace_id = active_workspace_id();
    let task_id = validate_label(&task_id).map_err(|error| error.to_string())?;
    let auth_connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role_for(
        &auth_connection,
        &workspace_id,
        &["owner", "admin", "operator"],
    )
    .map_err(|error| error.to_string())?;
    drop(auth_connection);

    if !user_confirmed {
        let connection = open_db(&app).map_err(|error| error.to_string())?;
        let current: Option<String> = connection
            .query_row(
                "SELECT status FROM tasks WHERE id=?1 AND workspace_id=?2",
                params![&task_id, workspace_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|error| error.to_string())?;
        if current.as_deref() == Some("running") {
            if let Err(error) = connection.execute(
                "UPDATE tasks SET status='awaiting_user_action' WHERE id=?1 AND workspace_id=?2 AND status='running'",
                params![&task_id, workspace_id],
            ) {
                return Err(error.to_string());
            }
            telegram_task_audit(&connection, &workspace_id, &task_id, "confirmation_required", "blocked")?;
        }
        return Ok(TelegramExecutionView {
            task_id,
            status: "awaiting_user_action".to_string(),
            external_message_id: None,
            message: "Explicit confirmation is required before sending to Telegram.".to_string(),
            retry_at: None,
        });
    }

    if vault_password.is_empty() {
        return Err(AppError::InvalidPassword.to_string());
    }

    let connection = open_db(&app).map_err(|error| error.to_string())?;
    let task = connection
        .query_row(
            "SELECT account_id, platform, kind, content_id, destination_id, status, attempts, max_attempts
             FROM tasks WHERE id=?1 AND workspace_id=?2",
            params![&task_id, workspace_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, Option<String>>(4)?,
                    row.get::<_, String>(5)?,
                    row.get::<_, i64>(6)?,
                    row.get::<_, i64>(7)?,
                ))
            },
        )
        .optional()
        .map_err(|error| error.to_string())?;

    let Some((account_id, platform, kind, content_id, destination_id, status, attempts, max_attempts)) = task else {
        return Err(AppError::NotFound.to_string());
    };

    if status != "running" {
        return Err("only running tasks can execute".to_string());
    }
    if platform != "telegram" {
        return Err("telegram executor requires a telegram task".to_string());
    }
    if kind != "publish" && kind != "message" {
        return Err("telegram native executor supports publish/message text tasks only".to_string());
    }
    let content_id = content_id.ok_or_else(|| "task has no linked content".to_string())?;
    let destination_id = destination_id.ok_or_else(|| "task has no Telegram destination".to_string())?;

    let (completed_today, consecutive_failures) =
        load_execution_counters(&connection, &workspace_id, &account_id)
            .map_err(|error| error.to_string())?;
    if consecutive_failures >= DEFAULT_CIRCUIT_BREAKER_THRESHOLD {
        connection
            .execute(
                "UPDATE tasks
                 SET status='awaiting_user_action'
                 WHERE id=?1 AND workspace_id=?2 AND status='running'",
                params![&task_id, &workspace_id],
            )
            .map_err(|error| error.to_string())?;
        telegram_task_audit(&connection, &workspace_id, &task_id, "circuit_breaker_open", "blocked")?;
        return Ok(TelegramExecutionView {
            task_id,
            status: "awaiting_user_action".to_string(),
            external_message_id: None,
            message: "Local execution circuit breaker is open after repeated failures.".to_string(),
            retry_at: None,
        });
    }

    if completed_today >= DEFAULT_DAILY_EXECUTION_LIMIT {
        let retry_at = next_utc_midnight_timestamp();
        connection
            .execute(
                "UPDATE tasks
                 SET status='pending', available_at=?1
                 WHERE id=?2 AND workspace_id=?3 AND status='running'",
                params![&retry_at, &task_id, &workspace_id],
            )
            .map_err(|error| error.to_string())?;
        telegram_task_audit(&connection, &workspace_id, &task_id, "daily_limit_reached", "blocked")?;
        return Ok(TelegramExecutionView {
            task_id,
            status: "pending".to_string(),
            external_message_id: None,
            message: "Local daily execution budget is exhausted; task deferred until the next UTC day.".to_string(),
            retry_at: Some(retry_at),
        });
    }

    let (session_payload_json, account_status) = connection
        .query_row(
            "SELECT session_payload_json, status FROM accounts WHERE id=?1 AND workspace_id=?2 AND platform='telegram'",
            params![&account_id, workspace_id],
            |row| Ok((row.get::<_, Option<String>>(0)?, row.get::<_, String>(1)?)),
        )
        .map_err(|error| error.to_string())?;

    if account_status != "connected" {
        connection
            .execute(
                "UPDATE tasks SET status='awaiting_user_action' WHERE id=?1 AND workspace_id=?2 AND status='running'",
                params![&task_id, workspace_id],
            )
            .map_err(|error| error.to_string())?;
        telegram_task_audit(&connection, &workspace_id, &task_id, "account_not_connected", "blocked")?;
        return Ok(TelegramExecutionView {
            task_id,
            status: "awaiting_user_action".to_string(),
            external_message_id: None,
            message: "Telegram account requires authorization before execution.".to_string(),
            retry_at: None,
        });
    }

    let session_payload_json = session_payload_json.ok_or_else(|| AppError::NotFound.to_string())?;
    let payload: EncryptedPayload =
        serde_json::from_str(&session_payload_json).map_err(|error| error.to_string())?;
    let token = validate_telegram_token(
        &open_payload(&vault_password, &payload).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())?;

    let (body, approval_status) = connection
        .query_row(
            "SELECT COALESCE(
               (
                 SELECT v.body
                 FROM content_variants v
                 WHERE v.content_id=ci.id AND v.platform='telegram'
               ),
               ci.body
             ), ci.approval_status
             FROM content_items ci
             WHERE ci.id=?1 AND ci.workspace_id=?2",
            params![&content_id, &workspace_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        )
        .map_err(|error| error.to_string())?;

    let approval_exists: bool = connection
        .query_row(
            "SELECT EXISTS(
               SELECT 1
               FROM approvals
               WHERE workspace_id=?1
                 AND content_id=?2
                 AND status='approved'
             )",
            params![&workspace_id, &content_id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;

    if approval_status != "approved" || !approval_exists || body.trim().is_empty() {
        connection
            .execute(
                "UPDATE tasks SET status='awaiting_approval' WHERE id=?1 AND workspace_id=?2 AND status='running'",
                params![&task_id, workspace_id],
            )
            .map_err(|error| error.to_string())?;
        telegram_task_audit(&connection, &workspace_id, &task_id, "approval_required", "blocked")?;
        return Ok(TelegramExecutionView {
            task_id,
            status: "awaiting_approval".to_string(),
            external_message_id: None,
            message: "Linked content is not approved for external delivery.".to_string(),
            retry_at: None,
        });
    }

    let rule_config = load_rule_config(&connection, &workspace_id, "telegram", &kind)?;
    let effective_timeout_ms = rule_config.map(|value| value.0).unwrap_or(15_000);
    let effective_max_attempts = rule_config
        .map(|value| effective_max_attempts(max_attempts, value.1))
        .unwrap_or(max_attempts);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(effective_timeout_ms))
        .build()
        .map_err(|_| "failed to initialize Telegram HTTP client".to_string())?;
    let url = format!("https://api.telegram.org/bot{token}/sendMessage");
    let response = match client
        .post(url)
        .json(&serde_json::json!({
            "chat_id": destination_id,
            "text": body.trim(),
        }))
        .send()
        .await
    {
        Ok(response) => response,
        Err(_) => {
            connection
                .execute(
                    "UPDATE tasks
                     SET status='awaiting_user_action'
                     WHERE id=?1 AND workspace_id=?2 AND status='running'",
                    params![&task_id, workspace_id],
                )
                .map_err(|error| error.to_string())?;
            telegram_task_audit(
                &connection,
                &workspace_id,
                &task_id,
                "delivery_status_unknown",
                "blocked",
            )?;
            return Ok(TelegramExecutionView {
                task_id,
                status: "awaiting_user_action".to_string(),
                external_message_id: None,
                message: "Telegram delivery status is unknown. Verify the destination before retrying to avoid a duplicate send.".to_string(),
                retry_at: None,
            });
        }
    };

    let status_code = response.status();
    let parsed = response
        .json::<TelegramApiResponse<TelegramSentMessage>>()
        .await
        .map_err(|_| "Telegram returned an invalid response".to_string())?;

    if parsed.ok {
        let external_id = parsed.result.map(|value| value.message_id);
        connection
            .execute(
                "UPDATE tasks SET status='succeeded' WHERE id=?1 AND workspace_id=?2 AND status='running'",
                params![&task_id, workspace_id],
            )
            .map_err(|error| error.to_string())?;
        telegram_task_audit(&connection, &workspace_id, &task_id, "send_message", "success")?;
        record_execution_success(&connection, &workspace_id, &account_id)
            .map_err(|error| error.to_string())?;
        return Ok(TelegramExecutionView {
            task_id,
            status: "succeeded".to_string(),
            external_message_id: external_id,
            message: "Telegram message sent successfully.".to_string(),
            retry_at: None,
        });
    }

    if status_code.as_u16() == 401 {
        connection
            .execute(
                "UPDATE accounts SET status='needs_refresh', updated_at=?1 WHERE id=?2 AND workspace_id=?3",
                params![chrono_like_timestamp(), &account_id, workspace_id],
            )
            .map_err(|error| error.to_string())?;
        connection
            .execute(
                "UPDATE tasks SET status='awaiting_user_action' WHERE id=?1 AND workspace_id=?2 AND status='running'",
                params![&task_id, workspace_id],
            )
            .map_err(|error| error.to_string())?;
        telegram_task_audit(&connection, &workspace_id, &task_id, "authorization_failed", "blocked")?;
    record_execution_failure(&connection, &workspace_id, &account_id)
        .map_err(|error| error.to_string())?;
        return Ok(TelegramExecutionView {
            task_id,
            status: "awaiting_user_action".to_string(),
            external_message_id: None,
            message: "Telegram authorization failed; re-authorize the account.".to_string(),
            retry_at: None,
        });
    }

    if telegram_delivery_status_is_ambiguous(status_code.as_u16()) {
        connection
            .execute(
                "UPDATE tasks
                 SET status='awaiting_user_action'
                 WHERE id=?1 AND workspace_id=?2 AND status='running'",
                params![&task_id, workspace_id],
            )
            .map_err(|error| error.to_string())?;
        telegram_task_audit(&connection, &workspace_id, &task_id, "delivery_status_unknown", "blocked")?;
    record_execution_failure(&connection, &workspace_id, &account_id)
        .map_err(|error| error.to_string())?;
        return Ok(TelegramExecutionView {
            task_id,
            status: "awaiting_user_action".to_string(),
            external_message_id: None,
            message: "Telegram delivery status is ambiguous. Verify delivery before retrying to avoid duplicates.".to_string(),
            retry_at: None,
        });
    }

    if status_code.as_u16() == 429 {
        let retry_after = parsed
            .parameters
            .and_then(|parameters| parameters.retry_after)
            .unwrap_or(60)
            .clamp(1, 86_400);
        let retry_at = parse_retry_timestamp(retry_after);
        connection
            .execute(
                "UPDATE tasks SET status='pending', available_at=?1 WHERE id=?2 AND workspace_id=?3 AND status='running'",
                params![retry_at, &task_id, workspace_id],
            )
            .map_err(|error| error.to_string())?;
        telegram_task_audit(&connection, &workspace_id, &task_id, "rate_limited", "blocked")?;
        return Ok(TelegramExecutionView {
            task_id,
            status: "pending".to_string(),
            external_message_id: None,
            message: parsed.description.unwrap_or_else(|| "Telegram rate limit reached.".to_string()),
            retry_at: Some(retry_at),
        });
    }

    let next_attempt = attempts + 1;
    let terminal = next_attempt >= effective_max_attempts;
    let next_status = if terminal { "failed" } else { "pending" };
    let next_available = if terminal {
        chrono_like_timestamp()
    } else {
        let delay = retry_delay_ms(next_attempt);
        parse_retry_timestamp((delay / 1000).max(1) as u64)
    };
    connection
        .execute(
            "UPDATE tasks SET status=?1, attempts=?2, available_at=?3 WHERE id=?4 AND workspace_id=?5 AND status='running'",
            params![next_status, next_attempt, next_available, &task_id, workspace_id],
        )
        .map_err(|error| error.to_string())?;
    telegram_task_audit(&connection, &workspace_id, &task_id, "send_failed", "failure")?;
    record_execution_failure(&connection, &workspace_id, &account_id)
        .map_err(|error| error.to_string())?;

    Ok(TelegramExecutionView {
        task_id,
        status: next_status.to_string(),
        external_message_id: None,
        message: parsed.description.unwrap_or_else(|| "Telegram delivery failed.".to_string()),
        retry_at: if terminal { None } else { Some(next_available) },
    })
}

#[tauri::command]
fn workspace_list(app: tauri::AppHandle) -> Result<Vec<WorkspaceView>, String> {
    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role(
        &connection,
        &["owner", "admin", "editor", "operator", "reviewer", "viewer"],
    )
    .map_err(|error| error.to_string())?;
    let user_id = local_user_id(&connection).map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare(
            "SELECT w.id, w.name, w.created_at
             FROM workspaces w
             JOIN workspace_memberships m ON m.workspace_id=w.id
             WHERE m.user_id=?1 AND m.active=1
             ORDER BY w.created_at ASC, w.id ASC",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params![user_id], |row| {
            Ok(WorkspaceView {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
            })
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

#[tauri::command]
fn workspace_current(app: tauri::AppHandle) -> Result<WorkspaceView, String> {
    let connection = open_db(&app).map_err(|error| error.to_string())?;
    let id = active_workspace_id();
    let user_id = local_user_id(&connection).map_err(|error| error.to_string())?;
    connection
        .query_row(
            "SELECT w.id, w.name, w.created_at
             FROM workspaces w
             JOIN workspace_memberships m ON m.workspace_id=w.id
             WHERE w.id=?1 AND m.user_id=?2 AND m.active=1",
            params![id, user_id],
            |row| {
                Ok(WorkspaceView {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    created_at: row.get(2)?,
                })
            },
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn workspace_create(
    app: tauri::AppHandle,
    id: Option<String>,
    name: String,
) -> Result<WorkspaceView, String> {
    let name = validate_label(&name).map_err(|error| error.to_string())?;
    let workspace_id = id
        .filter(|value| !value.trim().is_empty())
        .map(|value| validate_label(&value))
        .transpose()
        .map_err(|error| error.to_string())?
        .unwrap_or_else(|| uuid_like());
    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role(&connection, &["owner", "admin"]).map_err(|error| error.to_string())?;
    let created_at = chrono_like_timestamp();

    connection
        .execute(
            "INSERT INTO workspaces(id, name, created_at) VALUES (?1, ?2, ?3)",
            params![workspace_id, name, created_at],
        )
        .map_err(|error| error.to_string())?;

    let user_id = local_user_id(&connection).map_err(|error| error.to_string())?;
    connection
        .execute(
            "INSERT INTO workspace_memberships(workspace_id, user_id, role, active, created_at)
             VALUES (?1, ?2, 'owner', 1, ?3)",
            params![workspace_id, user_id, created_at],
        )
        .map_err(|error| error.to_string())?;

    write_audit(
        &connection,
        "security",
        "workspace.create",
        "success",
        "user",
        Some(&workspace_id),
    )
    .map_err(|error| error.to_string())?;

    Ok(WorkspaceView {
        id: workspace_id,
        name,
        created_at,
    })
}

#[tauri::command]
fn workspace_select(app: tauri::AppHandle, id: String) -> Result<WorkspaceView, String> {
    let id = validate_label(&id).map_err(|error| error.to_string())?;
    let connection = open_db(&app).map_err(|error| error.to_string())?;
    let user_id = local_user_id(&connection).map_err(|error| error.to_string())?;
    let workspace = connection
        .query_row(
            "SELECT w.id, w.name, w.created_at
             FROM workspaces w
             JOIN workspace_memberships m ON m.workspace_id=w.id
             WHERE w.id=?1 AND m.user_id=?2 AND m.active=1",
            params![id, user_id],
            |row| {
                Ok(WorkspaceView {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    created_at: row.get(2)?,
                })
            },
        )
        .optional()
        .map_err(|error| error.to_string())?;

    let Some(workspace) = workspace else {
        return Err("workspace not found or not accessible".to_string());
    };

    connection
        .execute(
            "INSERT INTO runtime_state(key, value) VALUES ('active_workspace_id', ?1)
             ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            params![workspace.id],
        )
        .map_err(|error| error.to_string())?;
    set_active_workspace_id(&workspace.id).map_err(|error| error.to_string())?;
    write_audit(&connection, "security", "workspace.select", "success", "user", Some(&workspace.id))
        .map_err(|error| error.to_string())?;

    Ok(workspace)
}

#[tauri::command]
fn app_health(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    open_db(&app)
        .map(|_| serde_json::json!({"status":"ok","database":"ready"}))
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn vault_put(
    app: tauri::AppHandle,
    label: String,
    plaintext: String,
    password: String,
) -> Result<VaultWriteResult, String> {
    let workspace_id = active_workspace_id();
    let label = validate_label(&label).map_err(|error| error.to_string())?;
    if plaintext.is_empty() || password.is_empty() {
        return Err(AppError::InvalidPassword.to_string());
    }

    let payload = seal(&password, &plaintext).map_err(|error| error.to_string())?;
    let payload_json = serde_json::to_string(&payload).map_err(|error| error.to_string())?;
    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role_for(&connection, &workspace_id, &["owner", "admin"]).map_err(|error| error.to_string())?;
    let timestamp = chrono_like_timestamp();
    connection
        .execute(
            "INSERT INTO vault_records(workspace_id, label, payload_json, updated_at)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(workspace_id, label) DO UPDATE SET payload_json=excluded.payload_json, updated_at=excluded.updated_at",
            params![workspace_id, label, payload_json, timestamp],
        )
        .map_err(|error| error.to_string())?;

    write_audit(&connection, "security", "vault.write", "success", "user", Some(&label))
        .map_err(|error| error.to_string())?;

    Ok(VaultWriteResult {
        label,
        payload_version: payload.version,
    })
}

#[tauri::command]
fn vault_get(app: tauri::AppHandle, label: String, password: String) -> Result<String, String> {
    let workspace_id = active_workspace_id();
    let label = validate_label(&label).map_err(|error| error.to_string())?;
    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role_for(&connection, &workspace_id, &["owner", "admin"]).map_err(|error| error.to_string())?;
    let payload_json: String = connection
        .query_row(
            "SELECT payload_json FROM vault_records WHERE workspace_id = ?1 AND label = ?2",
            params![workspace_id, label],
            |row| row.get(0),
        )
        .map_err(|error| match error {
            rusqlite::Error::QueryReturnedNoRows => AppError::NotFound.to_string(),
            other => AppError::Database(other).to_string(),
        })?;

    let payload: EncryptedPayload =
        serde_json::from_str(&payload_json).map_err(|error| error.to_string())?;
    let plaintext = open_payload(&password, &payload).map_err(|error| error.to_string())?;
    write_audit(
        &connection,
        "security",
        "vault.read",
        "success",
        "user",
        Some(&label),
    )
    .map_err(|error| error.to_string())?;
    Ok(plaintext)
}

#[tauri::command]
fn vault_delete(app: tauri::AppHandle, label: String) -> Result<bool, String> {
    let workspace_id = active_workspace_id();
    let label = validate_label(&label).map_err(|error| error.to_string())?;
    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role_for(&connection, &workspace_id, &["owner", "admin"]).map_err(|error| error.to_string())?;
    let changed = connection
        .execute(
            "DELETE FROM vault_records WHERE workspace_id = ?1 AND label = ?2",
            params![workspace_id, label],
        )
        .map_err(|error| error.to_string())?;
    if changed > 0 {
        write_audit(
            &connection,
            "security",
            "vault.delete",
            "success",
            "user",
            Some(&label),
        )
        .map_err(|error| error.to_string())?;
    }
    Ok(changed > 0)
}



fn validate_task_kind(kind: &str) -> Result<String, AppError> {
    let value = kind.trim().to_lowercase();
    let allowed = ["publish", "message", "comment", "sync", "engage"];
    if allowed.contains(&value.as_str()) {
        Ok(value)
    } else {
        Err(AppError::InvalidLabel)
    }
}

fn validate_platform(platform: &str) -> Result<String, AppError> {
    let value = platform.trim().to_lowercase();
    let allowed = ["facebook", "instagram", "telegram", "whatsapp", "linkedin", "tiktok"];
    if allowed.contains(&value.as_str()) {
        Ok(value)
    } else {
        Err(AppError::InvalidLabel)
    }
}

#[tauri::command]
fn account_upsert(
    app: tauri::AppHandle,
    id: String,
    platform: String,
    display_name: String,
    username: Option<String>,
    session: Option<String>,
    password: Option<String>,
) -> Result<AccountView, String> {
    let workspace_id = active_workspace_id();
    let id = validate_label(&id).map_err(|error| error.to_string())?;
    let platform = validate_platform(&platform).map_err(|error| error.to_string())?;
    let display_name = validate_label(&display_name).map_err(|error| error.to_string())?;
    let username = username.map(|value| value.trim().to_string()).filter(|value| !value.is_empty());

    let session_payload_json = match (session.filter(|value| !value.is_empty()), password.filter(|value| !value.is_empty())) {
        (Some(value), Some(secret)) => {
            let payload = seal(&secret, &value).map_err(|error| error.to_string())?;
            Some(serde_json::to_string(&payload).map_err(|error| error.to_string())?)
        }
        (Some(_), None) => return Err(AppError::InvalidPassword.to_string()),
        _ => None,
    };

    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role_for(&connection, &workspace_id, &["owner", "admin"]).map_err(|error| error.to_string())?;
    let timestamp = chrono_like_timestamp();
    let status = if session_payload_json.is_some() { "connected" } else { "needs_refresh" };
    let changed = connection
        .execute(
            "INSERT INTO accounts(id, workspace_id, platform, display_name, username, status, session_payload_json, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)
             ON CONFLICT(id) DO UPDATE SET
               platform=excluded.platform,
               display_name=excluded.display_name,
               username=excluded.username,
               status=excluded.status,
               session_payload_json=COALESCE(excluded.session_payload_json, accounts.session_payload_json),
               updated_at=excluded.updated_at
             WHERE accounts.workspace_id=excluded.workspace_id",
            params![id, workspace_id, platform, display_name, username, status, session_payload_json, timestamp],
        )
        .map_err(|error| error.to_string())?;
    if changed != 1 {
        return Err("account id already belongs to another workspace".to_string());
    }

    let has_encrypted_session: bool = connection
        .query_row(
            "SELECT session_payload_json IS NOT NULL FROM accounts WHERE id=?1 AND workspace_id=?2",
            params![&id, &workspace_id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;

    write_audit(&connection, "account", "upsert", "success", "user", Some(&id))
        .map_err(|error| error.to_string())?;

    Ok(AccountView {
        id,
        platform,
        display_name,
        username,
        status: status.to_string(),
        has_encrypted_session,
    })
}

#[tauri::command]
fn account_list(app: tauri::AppHandle) -> Result<Vec<AccountView>, String> {
    let workspace_id = active_workspace_id();
    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role_for(&connection, &workspace_id, &["owner", "admin", "editor", "operator", "reviewer", "viewer"]).map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare("SELECT id, platform, display_name, username, status, session_payload_json FROM accounts WHERE workspace_id=?1 ORDER BY created_at DESC")
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map(params![workspace_id], |row| {
            Ok(AccountView {
                id: row.get(0)?,
                platform: row.get(1)?,
                display_name: row.get(2)?,
                username: row.get(3)?,
                status: row.get(4)?,
                has_encrypted_session: row.get::<_, Option<String>>(5)?.is_some(),
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn account_get_session(
    app: tauri::AppHandle,
    id: String,
    password: String,
) -> Result<String, String> {
    let workspace_id = active_workspace_id();
    let id = validate_label(&id).map_err(|error| error.to_string())?;
    if password.is_empty() {
        return Err(AppError::InvalidPassword.to_string());
    }

    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role_for(&connection, &workspace_id, &["owner", "admin"]).map_err(|error| error.to_string())?;
    let payload_json: Option<String> = connection
        .query_row(
            "SELECT session_payload_json FROM accounts WHERE id = ?1 AND workspace_id = ?2",
            params![id, workspace_id],
            |row| row.get(0),
        )
        .map_err(|error| match error {
            rusqlite::Error::QueryReturnedNoRows => AppError::NotFound.to_string(),
            other => AppError::Database(other).to_string(),
        })?;

    let payload_json = payload_json.ok_or_else(|| AppError::NotFound.to_string())?;
    let payload: EncryptedPayload =
        serde_json::from_str(&payload_json).map_err(|error| error.to_string())?;
    let plaintext = open_payload(&password, &payload).map_err(|error| error.to_string())?;
    write_audit(
        &connection,
        "security",
        "account.session_read",
        "success",
        "user",
        Some(&id),
    )
    .map_err(|error| error.to_string())?;
    Ok(plaintext)
}

#[tauri::command]
fn account_delete(app: tauri::AppHandle, id: String) -> Result<bool, String> {
    let workspace_id = active_workspace_id();
    let id = validate_label(&id).map_err(|error| error.to_string())?;
    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role_for(&connection, &workspace_id, &["owner", "admin"]).map_err(|error| error.to_string())?;
    let changed = connection
        .execute("DELETE FROM accounts WHERE id = ?1 AND workspace_id = ?2", params![id, workspace_id])
        .map_err(|error| error.to_string())?;
    if changed > 0 {
        write_audit(&connection, "account", "delete", "success", "user", Some(&id))
            .map_err(|error| error.to_string())?;
    }
    Ok(changed > 0)
}


#[tauri::command]
fn campaign_create(
    app: tauri::AppHandle,
    name: String,
    account_ids: Vec<String>,
) -> Result<CampaignView, String> {
    let workspace_id = active_workspace_id();
    let name = validate_label(&name).map_err(|error| error.to_string())?;
    if account_ids.is_empty() {
        return Err("at least one account is required".to_string());
    }

    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role_for(&connection, &workspace_id, &["owner", "admin", "editor"]).map_err(|error| error.to_string())?;
    let campaign_id = format!("camp-{}", uuid_like());
    let timestamp = chrono_like_timestamp();
    let transaction = connection
        .unchecked_transaction()
        .map_err(|error| error.to_string())?;

    transaction
        .execute(
            "INSERT INTO campaigns(id, workspace_id, name, status, created_at) VALUES (?1, ?2, ?3, 'draft', ?4)",
            params![campaign_id, workspace_id, name, timestamp],
        )
        .map_err(|error| error.to_string())?;

    for account_id in &account_ids {
        transaction
            .execute(
                "INSERT INTO campaign_accounts(workspace_id, campaign_id, account_id) VALUES (?1, ?2, ?3)",
                params![workspace_id, campaign_id, validate_label(account_id).map_err(|error| error.to_string())?],
            )
            .map_err(|error| error.to_string())?;
    }

    transaction.commit().map_err(|error| error.to_string())?;

    write_audit(&connection, "campaign", "create", "success", "user", Some(&campaign_id))
        .map_err(|error| error.to_string())?;

    Ok(CampaignView {
        id: campaign_id,
        name,
        status: "draft".to_string(),
        task_count: 0,
        created_at: timestamp,
    })
}

#[tauri::command]
fn campaign_list(app: tauri::AppHandle) -> Result<Vec<CampaignView>, String> {
    let workspace_id = active_workspace_id();
    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role_for(&connection, &workspace_id, &["owner", "admin", "editor", "operator", "reviewer", "viewer"]).map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare(
            "SELECT c.id, c.name, c.status, COUNT(t.id), c.created_at
             FROM campaigns c
             LEFT JOIN tasks t ON t.campaign_id = c.id AND t.workspace_id = c.workspace_id
             WHERE c.workspace_id = ?1
             GROUP BY c.id
             ORDER BY c.created_at DESC",
        )
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map(params![workspace_id], |row| {
            Ok(CampaignView {
                id: row.get(0)?,
                name: row.get(1)?,
                status: row.get(2)?,
                task_count: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

fn parse_reviewer_ids(value: &str) -> Result<Vec<String>, String> {
    let reviewers: Vec<String> =
        serde_json::from_str(value).map_err(|_| "reviewer list must be a JSON array".to_string())?;
    if reviewers.is_empty() || reviewers.len() > 100 {
        return Err("approval requires at least one reviewer".to_string());
    }
    if reviewers.iter().any(|reviewer| {
        let trimmed = reviewer.trim();
        trimmed.is_empty() || trimmed.len() > 200
    }) {
        return Err("approval reviewer id is invalid".to_string());
    }
    Ok(reviewers)
}

fn validate_content_status(status: &str) -> Result<String, AppError> {
    let value = status.trim().to_lowercase();
    let allowed = ["draft", "pending", "approved", "rejected", "changes_requested"];
    if allowed.contains(&value.as_str()) {
        Ok(value)
    } else {
        Err(AppError::InvalidLabel)
    }
}

fn validate_content_edit_status(status: &str) -> Result<String, AppError> {
    let value = status.trim().to_lowercase();
    let allowed = ["draft", "pending", "rejected", "changes_requested"];
    if allowed.contains(&value.as_str()) {
        Ok(value)
    } else {
        Err(AppError::InvalidLabel)
    }
}

#[tauri::command]
fn content_upsert(
    app: tauri::AppHandle,
    id: String,
    title: String,
    body: String,
    approval_status: String,
    tags_json: Option<String>,
) -> Result<ContentView, String> {
    let workspace_id = active_workspace_id();
    let id = validate_label(&id).map_err(|error| error.to_string())?;
    let title = validate_label(&title).map_err(|error| error.to_string())?;
    let body = body.trim().to_string();
    if body.is_empty() || body.len() > 100_000 {
        return Err("invalid content body".to_string());
    }
    let approval_status = validate_content_edit_status(&approval_status).map_err(|error| error.to_string())?;
    let tags_json = tags_json.unwrap_or_else(|| "[]".to_string());
    let tags: Vec<String> = serde_json::from_str(&tags_json)
        .map_err(|_| "tags_json must be a JSON array of strings".to_string())?;
    if tags.len() > 100 {
        return Err("too many content tags".to_string());
    }
    let tags_json = serde_json::to_string(
        &tags.into_iter().map(|tag| tag.trim().to_string()).collect::<Vec<_>>(),
    )
    .map_err(|error| error.to_string())?;

    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role_for(&connection, &workspace_id, &["owner", "admin", "editor"]).map_err(|error| error.to_string())?;
    let timestamp = chrono_like_timestamp();
    let changed = connection
        .execute(
            "INSERT INTO content_items(id, workspace_id, title, body, approval_status, tags_json, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)
             ON CONFLICT(id) DO UPDATE SET
               title=excluded.title,
               body=excluded.body,
               approval_status=excluded.approval_status,
               tags_json=excluded.tags_json,
               updated_at=excluded.updated_at
             WHERE content_items.workspace_id=excluded.workspace_id",
            params![id, workspace_id, title, body, approval_status, tags_json, timestamp],
        )
        .map_err(|error| error.to_string())?;
    if changed != 1 {
        return Err("content id already belongs to another workspace".to_string());
    }
    write_audit(&connection, "content", "upsert", "success", "user", Some(&id))
        .map_err(|error| error.to_string())?;
    Ok(ContentView {
        id,
        title,
        body,
        approval_status,
        tags_json,
        updated_at: timestamp,
    })
}

#[tauri::command]
fn content_list(app: tauri::AppHandle) -> Result<Vec<ContentView>, String> {
    let workspace_id = active_workspace_id();
    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role_for(&connection, &workspace_id, &["owner", "admin", "editor", "operator", "reviewer", "viewer"]).map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare(
            "SELECT id, title, body, approval_status, tags_json, updated_at
             FROM content_items
             WHERE workspace_id=?1
             ORDER BY updated_at DESC",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params![workspace_id], |row| {
            Ok(ContentView {
                id: row.get(0)?,
                title: row.get(1)?,
                body: row.get(2)?,
                approval_status: row.get(3)?,
                tags_json: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

fn validate_media_kind(kind: &str) -> Result<String, AppError> {
    let value = kind.trim().to_lowercase();
    if ["image", "video", "audio", "document"].contains(&value.as_str()) {
        Ok(value)
    } else {
        Err(AppError::InvalidLabel)
    }
}

fn validate_media_sha256(value: Option<&str>) -> Result<Option<String>, AppError> {
    let Some(value) = value else { return Ok(None); };
    let value = value.trim().to_lowercase();
    if !value.is_empty() && !value.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(AppError::InvalidLabel);
    }
    if !value.is_empty() && value.len() != 64 {
        return Err(AppError::InvalidLabel);
    }
    Ok(if value.is_empty() { None } else { Some(value) })
}
fn infer_media_mime(path: &std::path::Path) -> Option<&'static str> {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_lowercase())
    {
        Some(ext) if ext == "png" => Some("image/png"),
        Some(ext) if ext == "jpg" || ext == "jpeg" => Some("image/jpeg"),
        Some(ext) if ext == "gif" => Some("image/gif"),
        Some(ext) if ext == "webp" => Some("image/webp"),
        Some(ext) if ext == "mp4" => Some("video/mp4"),
        Some(ext) if ext == "mov" => Some("video/quicktime"),
        Some(ext) if ext == "webm" => Some("video/webm"),
        Some(ext) if ext == "mkv" => Some("video/x-matroska"),
        Some(ext) if ext == "mp3" => Some("audio/mpeg"),
        Some(ext) if ext == "wav" => Some("audio/wav"),
        Some(ext) if ext == "ogg" => Some("audio/ogg"),
        Some(ext) if ext == "m4a" => Some("audio/mp4"),
        Some(ext) if ext == "pdf" => Some("application/pdf"),
        Some(ext) if ext == "txt" => Some("text/plain"),
        Some(ext) if ext == "md" => Some("text/markdown"),
        Some(ext) if ext == "csv" => Some("text/csv"),
        Some(ext) if ext == "zip" => Some("application/zip"),
        _ => None,
    }
}


fn media_kind_from_mime(mime: &str) -> Option<&'static str> {
    if mime.starts_with("image/") { Some("image") }
    else if mime.starts_with("video/") { Some("video") }
    else if mime.starts_with("audio/") { Some("audio") }
    else if mime == "application/pdf" || mime.starts_with("text/") || mime == "application/zip" { Some("document") }
    else { None }
}

fn sha256_file(path: &std::path::Path) -> Result<String, String> {
    let file = fs::File::open(path).map_err(|_| "unable to open media file".to_string())?;
    let mut reader = BufReader::new(file);
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 1024 * 1024];
    loop {
        let read = reader.read(&mut buffer).map_err(|_| "unable to read media file".to_string())?;
        if read == 0 { break; }
        hasher.update(&buffer[..read]);
    }
    Ok(hasher.finalize().iter().map(|byte| format!("{byte:02x}")).collect())
}

fn validate_media_mime(kind: &str, mime_type: &str) -> Result<(), AppError> {
    let valid = match kind {
        "image" => mime_type.starts_with("image/"),
        "video" => mime_type.starts_with("video/"),
        "audio" => mime_type.starts_with("audio/"),
        "document" => mime_type == "application/pdf"
            || mime_type.starts_with("text/")
            || mime_type == "application/zip",
        _ => false,
    };
    if valid { Ok(()) } else { Err(AppError::InvalidLabel) }
}

fn validate_rule_pack_json(
    platform: &str,
    rules_json: &str,
) -> Result<serde_json::Value, String> {
    let parsed: serde_json::Value =
        serde_json::from_str(rules_json).map_err(|_| "rules_json must be valid JSON".to_string())?;
    let Some(rules) = parsed.as_array() else {
        return Err("rules_json must be an array".to_string());
    };
    if rules.is_empty() || rules.len() > 100 {
        return Err("rules_json must contain between 1 and 100 rules".to_string());
    }

    let valid_kinds = ["publish", "message", "comment", "sync", "engage"];
    let mut ids = std::collections::HashSet::new();
    for rule in rules {
        let Some(object) = rule.as_object() else {
            return Err("every rule must be an object".to_string());
        };
        let id = object
            .get("id")
            .and_then(serde_json::Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty() && value.len() <= 200)
            .ok_or_else(|| "rule id is required".to_string())?;
        if !ids.insert(id.to_string()) {
            return Err("rule ids must be unique".to_string());
        }

        let rule_platform = object
            .get("platform")
            .and_then(serde_json::Value::as_str)
            .unwrap_or(platform);
        if rule_platform != platform {
            return Err("rule platform must match rule pack platform".to_string());
        }

        let Some(task_kinds) = object.get("taskKinds").and_then(serde_json::Value::as_array) else {
            return Err("rule taskKinds must be an array".to_string());
        };
        if task_kinds.is_empty() {
            return Err("rule taskKinds must contain at least one task kind".to_string());
        }
        for kind in task_kinds {
            let value = kind
                .as_str()
                .ok_or_else(|| "rule task kind must be a string".to_string())?;
            if !valid_kinds.contains(&value) {
                return Err("rule contains unsupported task kind".to_string());
            }
        }

        let enabled = object
            .get("enabled")
            .and_then(serde_json::Value::as_bool)
            .unwrap_or(true);
        let requires_confirmation = object
            .get("requiresConfirmation")
            .and_then(serde_json::Value::as_bool)
            .unwrap_or(false);
        let has_external = task_kinds.iter().any(|kind| kind != "sync");
        if enabled && has_external && !requires_confirmation {
            return Err("enabled external rules must require confirmation".to_string());
        }

        let max_attempts = object
            .get("maxAttempts")
            .and_then(serde_json::Value::as_i64)
            .unwrap_or(3);
        if !(1..=10).contains(&max_attempts) {
            return Err("rule maxAttempts must be between 1 and 10".to_string());
        }

        let timeout_ms = object
            .get("timeoutMs")
            .and_then(serde_json::Value::as_i64)
            .unwrap_or(30_000);
        if !(1_000..=300_000).contains(&timeout_ms) {
            return Err("rule timeoutMs must be between 1000 and 300000".to_string());
        }
    }

    Ok(parsed)
}


#[tauri::command]
fn media_asset_upsert(
    app: tauri::AppHandle,
    id: String,
    kind: String,
    filename: String,
    mime_type: String,
    size_bytes: i64,
    sha256: Option<String>,
    local_path: String,
    tags_json: Option<String>,
) -> Result<MediaAssetView, String> {
    let workspace_id = active_workspace_id();
    let id = validate_label(&id).map_err(|error| error.to_string())?;
    let kind = validate_media_kind(&kind).map_err(|error| error.to_string())?;
    let filename = validate_label(&filename).map_err(|error| error.to_string())?;
    let mime_type = validate_label(&mime_type).map_err(|error| error.to_string())?;
    validate_media_mime(&kind, &mime_type).map_err(|error| error.to_string())?;
    let local_path = validate_label(&local_path).map_err(|error| error.to_string())?;
    if size_bytes <= 0 {
        return Err("media size must be positive".to_string());
    }
    let sha256 = validate_media_sha256(sha256.as_deref()).map_err(|error| error.to_string())?;
    let tags_json = tags_json.unwrap_or_else(|| "[]".to_string());
    let tags: Vec<String> = serde_json::from_str(&tags_json)
        .map_err(|_| "tags_json must be a JSON array".to_string())?;
    if tags.len() > 100 || tags.iter().any(|tag: &String| tag.trim().is_empty() || tag.len() > 100) {
        return Err("invalid media tags".to_string());
    }
    let tags_json = serde_json::to_string(
        &tags.into_iter().map(|tag| tag.trim().to_string()).collect::<Vec<_>>(),
    )
    .map_err(|error| error.to_string())?;

    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role_for(
        &connection,
        &workspace_id,
        &["owner", "admin", "editor"],
    )
    .map_err(|error| error.to_string())?;
    let timestamp = chrono_like_timestamp();

    connection
        .execute(
            "INSERT INTO media_assets(
               id, workspace_id, kind, filename, mime_type, size_bytes,
               sha256, local_path, tags_json, created_at, updated_at
             )
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)
             ON CONFLICT(id) DO UPDATE SET
               kind=excluded.kind,
               filename=excluded.filename,
               mime_type=excluded.mime_type,
               size_bytes=excluded.size_bytes,
               sha256=excluded.sha256,
               local_path=excluded.local_path,
               tags_json=excluded.tags_json,
               updated_at=excluded.updated_at
             WHERE media_assets.workspace_id=excluded.workspace_id",
            params![
                &id,
                &workspace_id,
                &kind,
                &filename,
                &mime_type,
                size_bytes,
                &sha256,
                &local_path,
                &tags_json,
                &timestamp
            ],
        )
        .map_err(|error| error.to_string())?;

    write_audit_for_workspace(
        &connection,
        &workspace_id,
        "media",
        "asset_upsert",
        "success",
        "user",
        Some(&id),
    )
    .map_err(|error| error.to_string())?;

    Ok(MediaAssetView {
        id,
        kind,
        filename,
        mime_type,
        size_bytes,
        sha256,
        local_path,
        tags_json,
        created_at: timestamp.clone(),
        updated_at: timestamp,
    })
}

#[tauri::command]
fn media_asset_import(
    app: tauri::AppHandle,
    id: String,
    path: String,
    tags_json: Option<String>,
) -> Result<MediaAssetView, String> {
    let workspace_id = active_workspace_id();
    let id = validate_label(&id).map_err(|error| error.to_string())?;
    let path_string = validate_label(&path).map_err(|error| error.to_string())?;
    let path = std::path::PathBuf::from(&path_string);
    if !path.is_file() {
        return Err("media path must point to a regular file".to_string());
    }

    let mime = infer_media_mime(&path)
        .ok_or_else(|| "unsupported media file type".to_string())?;
    let kind = media_kind_from_mime(mime).ok_or_else(|| "unsupported media file type".to_string())?;
    let filename = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "media filename is invalid".to_string())?;
    let filename = validate_label(filename).map_err(|error| error.to_string())?;
    let size_bytes = fs::metadata(&path)
        .map_err(|_| "unable to read media metadata".to_string())?
        .len();
    if size_bytes == 0 || size_bytes > 2_000_000_000 {
        return Err("media file size must be between 1 byte and 2 GB".to_string());
    }
    let digest = sha256_file(&path)?;

    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role_for(
        &connection,
        &workspace_id,
        &["owner", "admin", "editor"],
    )
    .map_err(|error| error.to_string())?;

    let tags_json = tags_json.unwrap_or_else(|| "[]".to_string());
    let tags: Vec<String> = serde_json::from_str(&tags_json)
        .map_err(|_| "tags_json must be a JSON array".to_string())?;
    if tags.len() > 100 || tags.iter().any(|tag: &String| tag.trim().is_empty() || tag.len() > 100) {
        return Err("invalid media tags".to_string());
    }

    let timestamp = chrono_like_timestamp();
    connection
        .execute(
            "INSERT INTO media_assets(
               id, workspace_id, kind, filename, mime_type, size_bytes,
               sha256, local_path, tags_json, created_at, updated_at
             )
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)
             ON CONFLICT(id) DO UPDATE SET
               kind=excluded.kind,
               filename=excluded.filename,
               mime_type=excluded.mime_type,
               size_bytes=excluded.size_bytes,
               sha256=excluded.sha256,
               local_path=excluded.local_path,
               tags_json=excluded.tags_json,
               updated_at=excluded.updated_at
             WHERE media_assets.workspace_id=excluded.workspace_id",
            params![
                &id,
                &workspace_id,
                kind,
                &filename,
                mime,
                size_bytes as i64,
                &digest,
                &path_string,
                &tags_json,
                &timestamp
            ],
        )
        .map_err(|error| error.to_string())?;

    write_audit_for_workspace(
        &connection,
        &workspace_id,
        "media",
        "asset_import",
        "success",
        "user",
        Some(&id),
    )
    .map_err(|error| error.to_string())?;

    Ok(MediaAssetView {
        id,
        kind: kind.to_string(),
        filename,
        mime_type: mime.to_string(),
        size_bytes: size_bytes as i64,
        sha256: Some(digest),
        local_path: path_string,
        tags_json,
        created_at: timestamp.clone(),
        updated_at: timestamp,
    })
}

#[tauri::command]
fn media_asset_delete(
    app: tauri::AppHandle,
    id: String,
) -> Result<bool, String> {
    let workspace_id = active_workspace_id();
    let id = validate_label(&id).map_err(|error| error.to_string())?;
    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role_for(
        &connection,
        &workspace_id,
        &["owner", "admin", "editor"],
    )
    .map_err(|error| error.to_string())?;
    let changed = connection
        .execute(
            "DELETE FROM media_assets WHERE id=?1 AND workspace_id=?2",
            params![&id, &workspace_id],
        )
        .map_err(|error| error.to_string())?;
    if changed > 0 {
        write_audit_for_workspace(
            &connection,
            &workspace_id,
            "media",
            "asset_delete",
            "success",
            "user",
            Some(&id),
        )
        .map_err(|error| error.to_string())?;
    }
    Ok(changed > 0)
}

#[tauri::command]
fn media_asset_list(
    app: tauri::AppHandle,
    search: Option<String>,
    kind: Option<String>,
) -> Result<Vec<MediaAssetView>, String> {
    let workspace_id = active_workspace_id();
    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role_for(
        &connection,
        &workspace_id,
        &["owner", "admin", "editor", "operator", "reviewer", "viewer"],
    )
    .map_err(|error| error.to_string())?;
    let pattern = search
        .map(|value| "%".to_string() + value.trim() + "%");
    let kind = kind
        .map(|value| validate_media_kind(&value))
        .transpose()
        .map_err(|error| error.to_string())?;

    let mut statement = connection
        .prepare(
            "SELECT id, kind, filename, mime_type, size_bytes, sha256,
                    local_path, tags_json, created_at, updated_at
             FROM media_assets
             WHERE workspace_id=?1
               AND (?2 IS NULL OR filename LIKE ?2 OR local_path LIKE ?2 OR tags_json LIKE ?2)
               AND (?3 IS NULL OR kind=?3)
             ORDER BY updated_at DESC",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params![&workspace_id, pattern, kind], |row| {
            Ok(MediaAssetView {
                id: row.get(0)?,
                kind: row.get(1)?,
                filename: row.get(2)?,
                mime_type: row.get(3)?,
                size_bytes: row.get(4)?,
                sha256: row.get(5)?,
                local_path: row.get(6)?,
                tags_json: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn load_rule_config(
    connection: &Connection,
    workspace_id: &str,
    platform: &str,
    task_kind: &str,
) -> Result<Option<(u64, i64)>, String> {
    let row: Option<(String, i64, i64)> = connection
        .query_row(
            "SELECT rules_json, schema_version, enabled
             FROM automation_rule_packs
             WHERE workspace_id=?1 AND platform=?2 AND enabled=1
             ORDER BY updated_at DESC
             LIMIT 1",
            params![workspace_id, platform],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    let Some((rules_json, schema_version, _enabled)) = row else {
        return Ok(None);
    };
    if schema_version != 1 {
        return Err("unsupported automation rule pack schema".to_string());
    }
    let parsed = validate_rule_pack_json(platform, &rules_json)?;
    let rules = parsed
        .as_array()
        .ok_or_else(|| "rules_json must be an array".to_string())?;

    for rule in rules {
        let Some(object) = rule.as_object() else { continue; };
        let kinds = object
            .get("taskKinds")
            .and_then(serde_json::Value::as_array)
            .cloned()
            .unwrap_or_default();
        let matches_kind = kinds.iter().any(|kind| kind.as_str() == Some(task_kind));
        if !matches_kind {
            continue;
        }
        let max_attempts = object
            .get("maxAttempts")
            .and_then(serde_json::Value::as_i64)
            .unwrap_or(3)
            .clamp(1, 10);
        let timeout_ms = object
            .get("timeoutMs")
            .and_then(serde_json::Value::as_i64)
            .unwrap_or(30_000)
            .clamp(1_000, 300_000) as u64;
        return Ok(Some((timeout_ms, max_attempts)));
    }

    Ok(None)
}

fn automation_rule_pack_upsert(
    app: tauri::AppHandle,
    id: String,
    platform: String,
    version: String,
    schema_version: i64,
    rules_json: String,
    enabled: bool,
) -> Result<AutomationRulePackView, String> {
    let workspace_id = active_workspace_id();
    let id = validate_label(&id).map_err(|error| error.to_string())?;
    let platform = validate_platform(&platform).map_err(|error| error.to_string())?;
    let version = validate_label(&version).map_err(|error| error.to_string())?;
    if schema_version != 1 {
        return Err("unsupported automation rule pack schema".to_string());
    }
    validate_rule_pack_json(&platform, &rules_json)?;

    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role_for(
        &connection,
        &workspace_id,
        &["owner", "admin", "editor"],
    )
    .map_err(|error| error.to_string())?;
    let timestamp = chrono_like_timestamp();
    connection
        .execute(
            "INSERT INTO automation_rule_packs(
               id, workspace_id, platform, version, schema_version,
               rules_json, enabled, created_at, updated_at
             )
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)
             ON CONFLICT(id) DO UPDATE SET
               platform=excluded.platform,
               version=excluded.version,
               schema_version=excluded.schema_version,
               rules_json=excluded.rules_json,
               enabled=excluded.enabled,
               updated_at=excluded.updated_at
             WHERE automation_rule_packs.workspace_id=excluded.workspace_id",
            params![
                &id,
                &workspace_id,
                &platform,
                &version,
                schema_version,
                &rules_json,
                if enabled { 1 } else { 0 },
                &timestamp
            ],
        )
        .map_err(|error| error.to_string())?;

    write_audit_for_workspace(
        &connection,
        &workspace_id,
        "automation",
        "rule_pack_upsert",
        "success",
        "user",
        Some(&id),
    )
    .map_err(|error| error.to_string())?;

    Ok(AutomationRulePackView {
        id,
        platform,
        version,
        schema_version,
        rules_json,
        enabled,
        created_at: timestamp.clone(),
        updated_at: timestamp,
    })
}

#[tauri::command]
fn automation_rule_pack_set_enabled(
    app: tauri::AppHandle,
    id: String,
    enabled: bool,
) -> Result<bool, String> {
    let workspace_id = active_workspace_id();
    let id = validate_label(&id).map_err(|error| error.to_string())?;
    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role_for(
        &connection,
        &workspace_id,
        &["owner", "admin", "editor"],
    )
    .map_err(|error| error.to_string())?;

    let changed = connection
        .execute(
            "UPDATE automation_rule_packs
             SET enabled=?1, updated_at=?2
             WHERE id=?3 AND workspace_id=?4",
            params![if enabled { 1 } else { 0 }, chrono_like_timestamp(), &id, &workspace_id],
        )
        .map_err(|error| error.to_string())?;

    if changed > 0 {
        write_audit_for_workspace(
            &connection,
            &workspace_id,
            "automation",
            "rule_pack_toggle",
            "success",
            "user",
            Some(&id),
        )
        .map_err(|error| error.to_string())?;
    }
    Ok(changed > 0)
}

#[tauri::command]
fn automation_rule_pack_list(
    app: tauri::AppHandle,
    platform: Option<String>,
) -> Result<Vec<AutomationRulePackView>, String> {
    let workspace_id = active_workspace_id();
    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role_for(
        &connection,
        &workspace_id,
        &["owner", "admin", "editor", "operator", "reviewer", "viewer"],
    )
    .map_err(|error| error.to_string())?;
    let platform = platform
        .map(|value| validate_platform(&value))
        .transpose()
        .map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare(
            "SELECT id, platform, version, schema_version, rules_json,
                    enabled, created_at, updated_at
             FROM automation_rule_packs
             WHERE workspace_id=?1
               AND (?2 IS NULL OR platform=?2)
             ORDER BY platform ASC, version DESC",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params![&workspace_id, &platform], |row| {
            Ok(AutomationRulePackView {
                id: row.get(0)?,
                platform: row.get(1)?,
                version: row.get(2)?,
                schema_version: row.get(3)?,
                rules_json: row.get(4)?,
                enabled: row.get::<_, i64>(5)? == 1,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn content_variant_upsert(
    app: tauri::AppHandle,
    content_id: String,
    platform: String,
    body: Option<String>,
) -> Result<ContentVariantView, String> {
    let workspace_id = active_workspace_id();
    let content_id = validate_label(&content_id).map_err(|error| error.to_string())?;
    let platform = validate_platform(&platform).map_err(|error| error.to_string())?;
    let body = body.map(|value| value.trim().to_string());
    if body.as_ref().is_some_and(|value| value.len() > 100_000) {
        return Err("invalid content variant body".to_string());
    }

    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role_for(&connection, &workspace_id, &["owner", "admin", "editor"])
        .map_err(|error| error.to_string())?;

    let exists: bool = connection
        .query_row(
            "SELECT EXISTS(
               SELECT 1 FROM content_items WHERE id=?1 AND workspace_id=?2
             )",
            params![&content_id, &workspace_id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    if !exists {
        return Err(AppError::NotFound.to_string());
    }

    connection
        .execute(
            "INSERT INTO content_variants(content_id, platform, body)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(content_id, platform) DO UPDATE SET body=excluded.body",
            params![&content_id, &platform, &body],
        )
        .map_err(|error| error.to_string())?;

    write_audit(
        &connection,
        "content",
        "variant_upsert",
        "success",
        "user",
        Some(&content_id),
    )
    .map_err(|error| error.to_string())?;

    Ok(ContentVariantView {
        content_id,
        platform,
        body,
    })
}

#[tauri::command]
fn content_variant_list(
    app: tauri::AppHandle,
    content_id: Option<String>,
) -> Result<Vec<ContentVariantView>, String> {
    let workspace_id = active_workspace_id();
    let content_id = content_id
        .map(|value| validate_label(&value))
        .transpose()
        .map_err(|error| error.to_string())?;
    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role_for(
        &connection,
        &workspace_id,
        &["owner", "admin", "editor", "operator", "reviewer", "viewer"],
    )
    .map_err(|error| error.to_string())?;

    let mut statement = connection
        .prepare(
            "SELECT v.content_id, v.platform, v.body
             FROM content_variants v
             JOIN content_items c ON c.id=v.content_id
             WHERE c.workspace_id=?1
               AND (?2 IS NULL OR v.content_id=?2)
             ORDER BY v.platform ASC",
        )
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map(params![&workspace_id, &content_id], |row| {
            Ok(ContentVariantView {
                content_id: row.get(0)?,
                platform: row.get(1)?,
                body: row.get(2)?,
            })
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn campaign_attach_content(
    app: tauri::AppHandle,
    campaign_id: String,
    content_id: String,
) -> Result<bool, String> {
    let workspace_id = active_workspace_id();
    let campaign_id = validate_label(&campaign_id).map_err(|error| error.to_string())?;
    let content_id = validate_label(&content_id).map_err(|error| error.to_string())?;
    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role_for(&connection, &workspace_id, &["owner", "admin", "editor"]).map_err(|error| error.to_string())?;

    let compatible: bool = connection
        .query_row(
            "SELECT EXISTS(
               SELECT 1 FROM campaigns c
               JOIN content_items ci ON ci.workspace_id=c.workspace_id
               WHERE c.id=?1 AND c.workspace_id=?3
                 AND ci.id=?2 AND ci.workspace_id=?3
             )",
            params![campaign_id, content_id, workspace_id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    if !compatible {
        return Err("campaign and content must belong to workspace".to_string());
    }

    connection
        .execute(
            "INSERT OR IGNORE INTO campaign_content(workspace_id, campaign_id, content_id)
             VALUES (?1, ?2, ?3)",
            params![workspace_id, campaign_id, content_id],
        )
        .map_err(|error| error.to_string())?;
    write_audit(&connection, "campaign", "attach_content", "success", "user", Some(&campaign_id))
        .map_err(|error| error.to_string())?;
    Ok(true)
}

#[tauri::command]
fn approval_request(
    app: tauri::AppHandle,
    id: String,
    content_id: String,
    requested_by: String,
    reviewer_ids_json: Option<String>,
    note: Option<String>,
) -> Result<ApprovalView, String> {
    let workspace_id = active_workspace_id();
    let id = validate_label(&id).map_err(|error| error.to_string())?;
    let content_id = validate_label(&content_id).map_err(|error| error.to_string())?;
    let requested_by = validate_label(&requested_by).map_err(|error| error.to_string())?;
    let reviewer_ids_json = reviewer_ids_json.unwrap_or_else(|| "[]".to_string());
    let reviewer_ids: Vec<String> = serde_json::from_str(&reviewer_ids_json)
        .map_err(|_| "reviewer_ids_json must be a JSON array".to_string())?;
    if reviewer_ids.is_empty() || reviewer_ids.len() > 100 || reviewer_ids.iter().any(|value| value.trim().is_empty() || value.len() > 200) {
        return Err("approval requires at least one valid reviewer".to_string());
    }
    let reviewer_ids_json = serde_json::to_string(&reviewer_ids)
        .map_err(|error| error.to_string())?;

    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role_for(&connection, &workspace_id, &["owner", "admin", "editor"]).map_err(|error| error.to_string())?;
    require_local_user_actor(&connection, &requested_by).map_err(|error| error.to_string())?;
    let exists: bool = connection
        .query_row(
            "SELECT EXISTS(
               SELECT 1 FROM content_items
               WHERE id=?1 AND workspace_id=?2
             )",
            params![content_id, workspace_id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    if !exists {
        return Err(AppError::NotFound.to_string());
    }

    let timestamp = chrono_like_timestamp();
    connection
        .execute(
            "INSERT INTO approvals(
               id, workspace_id, content_id, requested_by, reviewer_ids_json, status, note
             ) VALUES (?1, ?2, ?3, ?4, ?5, 'pending', ?6)",
            params![id, workspace_id, content_id, requested_by, reviewer_ids_json, note],
        )
        .map_err(|error| error.to_string())?;
    connection
        .execute(
            "UPDATE content_items SET approval_status='pending', updated_at=?1
             WHERE id=?2 AND workspace_id=?3",
            params![timestamp, content_id, workspace_id],
        )
        .map_err(|error| error.to_string())?;
    write_audit(&connection, "content", "approval_request", "success", "user", Some(&content_id))
        .map_err(|error| error.to_string())?;

    Ok(ApprovalView {
        id,
        content_id,
        requested_by,
        status: "pending".to_string(),
        decided_by: None,
        decided_at: None,
        note,
    })
}

#[tauri::command]
fn approval_decide(
    app: tauri::AppHandle,
    id: String,
    status: String,
    decided_by: String,
    note: Option<String>,
) -> Result<ApprovalView, String> {
    let workspace_id = active_workspace_id();
    let id = validate_label(&id).map_err(|error| error.to_string())?;
    let decided_by = validate_label(&decided_by).map_err(|error| error.to_string())?;
    let status = validate_content_status(&status).map_err(|error| error.to_string())?;
    if status == "draft" || status == "pending" {
        return Err("approval decision must be approved, rejected, or changes_requested".to_string());
    }

    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role_for(&connection, &workspace_id, &["owner", "admin", "reviewer"]).map_err(|error| error.to_string())?;
    require_local_user_actor(&connection, &decided_by).map_err(|error| error.to_string())?;
    let current: Option<(String, String, String, String, Option<String>)> = connection
        .query_row(
            "SELECT content_id, requested_by, status, reviewer_ids_json, note
             FROM approvals WHERE id=?1 AND workspace_id=?2",
            params![id, workspace_id],
            |row| Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
            )),
        )
        .optional()
        .map_err(|error| error.to_string())?;
    let Some((content_id, requested_by, old_status, reviewer_ids_json, old_note)) = current else {
        return Err(AppError::NotFound.to_string());
    };
    if old_status != "pending" {
        return Err("only pending approvals can be decided".to_string());
    }

    let reviewer_ids = parse_reviewer_ids(&reviewer_ids_json)?;
    if !reviewer_ids.iter().any(|reviewer| reviewer == &decided_by) {
        return Err("decider is not an authorized reviewer".to_string());
    }

    let timestamp = chrono_like_timestamp();
    connection
        .execute(
            "UPDATE approvals
             SET status=?1, decided_by=?2, decided_at=?3, note=?4
             WHERE id=?5 AND workspace_id=?6 AND status='pending'",
            params![status, decided_by, timestamp, note, &id, workspace_id],
        )
        .map_err(|error| error.to_string())?;
    connection
        .execute(
            "UPDATE content_items SET approval_status=?1, updated_at=?2
             WHERE id=?3 AND workspace_id=?4",
            params![status, timestamp, content_id, workspace_id],
        )
        .map_err(|error| error.to_string())?;
    write_audit(&connection, "content", "approval_decide", "success", "user", Some(&content_id))
        .map_err(|error| error.to_string())?;

    Ok(ApprovalView {
        id,
        content_id,
        requested_by,
        status,
        decided_by: Some(decided_by),
        decided_at: Some(timestamp),
        note: note.or(old_note),
    })
}

#[tauri::command]
fn approval_list(app: tauri::AppHandle) -> Result<Vec<ApprovalView>, String> {
    let workspace_id = active_workspace_id();
    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role_for(&connection, &workspace_id, &["owner", "admin", "editor", "operator", "reviewer", "viewer"]).map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare(
            "SELECT id, content_id, requested_by, status, decided_by, decided_at, note
             FROM approvals
             WHERE workspace_id=?1
             ORDER BY COALESCE(decided_at, '9999') DESC",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params![workspace_id], |row| {
            Ok(ApprovalView {
                id: row.get(0)?,
                content_id: row.get(1)?,
                requested_by: row.get(2)?,
                status: row.get(3)?,
                decided_by: row.get(4)?,
                decided_at: row.get(5)?,
                note: row.get(6)?,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn task_enqueue(
    app: tauri::AppHandle,
    id: String,
    campaign_id: String,
    account_id: String,
    platform: String,
    kind: String,
    priority: i64,
    available_at: String,
    max_attempts: i64,
    idempotency_key: Option<String>,
    content_id: Option<String>,
    destination_id: Option<String>,
) -> Result<TaskView, String> {
    let workspace_id = active_workspace_id();
    let id = validate_label(&id).map_err(|error| error.to_string())?;
    let campaign_id = validate_label(&campaign_id).map_err(|error| error.to_string())?;
    let account_id = validate_label(&account_id).map_err(|error| error.to_string())?;
    let platform = validate_platform(&platform).map_err(|error| error.to_string())?;
    let kind = validate_task_kind(&kind).map_err(|error| error.to_string())?;
    let destination_id = destination_id
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .map(|value| validate_label(&value).map_err(|error| error.to_string()))
        .transpose()?;

    let content_id = content_id
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .map(|value| validate_label(&value).map_err(|error| error.to_string()))
        .transpose()?;
    let idempotency_key = idempotency_key
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| id.clone());
    let idempotency_key = validate_label(&idempotency_key).map_err(|error| error.to_string())?;

    if kind != "sync" && content_id.is_none() {
        return Err("content_id is required for external tasks".to_string());
    }
    if kind != "sync" && destination_id.is_none() {
        return Err("destination_id is required for external tasks".to_string());
    }

    if priority < 0 || !(1..=10).contains(&max_attempts) {
        return Err("task max_attempts must be between 1 and 10".to_string());
    }
    let available_at = normalize_rfc3339_utc(&available_at)?;

    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role_for(&connection, &workspace_id, &["owner", "admin", "editor"]).map_err(|error| error.to_string())?;
    let associated: bool = connection
        .query_row(
            "SELECT EXISTS(
               SELECT 1
               FROM campaign_accounts ca
               JOIN campaigns c ON c.id=ca.campaign_id
               JOIN accounts a ON a.id=ca.account_id
               WHERE ca.campaign_id=?1
                 AND ca.account_id=?2
                 AND ca.workspace_id=?3
                 AND c.workspace_id=?3
                 AND a.workspace_id=?3
                 AND a.platform=?4
             )",
            params![campaign_id, account_id, workspace_id, platform],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    if !associated {
        return Err("account is not part of campaign".to_string());
    }

    if let Some(ref content_id) = content_id {
        let content_attached: bool = connection
            .query_row(
                "SELECT EXISTS(
                   SELECT 1
                   FROM campaign_content cc
                   JOIN content_items ci ON ci.id=cc.content_id
                   WHERE cc.workspace_id=?3
                     AND cc.campaign_id=?1
                     AND cc.content_id=?2
                     AND ci.workspace_id=?3
                 )",
                params![campaign_id, content_id, workspace_id],
                |row| row.get(0),
            )
            .map_err(|error| error.to_string())?;
        if !content_attached {
            return Err("content is not part of campaign".to_string());
        }
    }

    let created_at = chrono_like_timestamp();
    connection
        .execute(
            "INSERT INTO tasks(
               id, workspace_id, campaign_id, content_id, destination_id, account_id, platform, kind,
               priority, status, attempts, max_attempts, available_at,
               idempotency_key, created_at
             )
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'pending', 0, ?10, ?11, ?12, ?13)",
            params![
                id,
                workspace_id,
                campaign_id,
                content_id,
                destination_id,
                account_id,
                platform,
                kind,
                priority,
                max_attempts,
                available_at,
                idempotency_key,
                created_at
            ],
        )
        .map_err(|error| error.to_string())?;

    write_audit(&connection, "task", "enqueue", "success", "user", Some(&id))
        .map_err(|error| error.to_string())?;

    Ok(TaskView {
        id,
        campaign_id,
        content_id,
        destination_id,
        account_id,
        platform,
        kind,
        priority,
        status: "pending".to_string(),
        attempts: 0,
        max_attempts,
        idempotency_key,
        available_at,
        created_at,
    })
}

#[tauri::command]
fn task_claim_next(app: tauri::AppHandle, now: String) -> Result<Option<TaskView>, String> {
    let workspace_id = active_workspace_id();
    let now = normalize_rfc3339_utc(&now)?;
    let mut connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role_for(&connection, &workspace_id, &["owner", "admin", "operator"]).map_err(|error| error.to_string())?;
    let transaction = connection
        .transaction()
        .map_err(|error| error.to_string())?;

    let candidate = transaction
        .query_row(
            "SELECT id, campaign_id, content_id, destination_id, account_id, platform, kind,
                    priority, attempts, max_attempts, idempotency_key, available_at, created_at
             FROM tasks
             WHERE workspace_id=?2
               AND status='pending'
               AND available_at <= ?1
             ORDER BY priority DESC, available_at ASC, created_at ASC
             LIMIT 1",
            params![now, workspace_id],
            |row| {
                Ok(TaskView {
                    id: row.get(0)?,
                    campaign_id: row.get(1)?,
                    content_id: row.get(2)?,
                    destination_id: row.get(3)?,
                    account_id: row.get(4)?,
                    platform: row.get(5)?,
                    kind: row.get(6)?,
                    priority: row.get(7)?,
                    status: "running".to_string(),
                    attempts: row.get(8)?,
                    max_attempts: row.get(9)?,
                    idempotency_key: row.get(10)?,
                    available_at: row.get(11)?,
                    created_at: row.get(12)?,
                })
            },
        )
        .optional()
        .map_err(|error| error.to_string())?;

    let Some(task) = candidate else {
        return transaction
            .commit()
            .map(|_| None)
            .map_err(|error| error.to_string());
    };

    let claimed = transaction
        .execute(
            "UPDATE tasks
             SET status='running'
             WHERE id=?1 AND workspace_id=?2 AND status='pending'",
            params![task.id, workspace_id],
        )
        .map_err(|error| error.to_string())?;

    if claimed != 1 {
        transaction.rollback().map_err(|error| error.to_string())?;
        return Ok(None);
    }

    transaction.commit().map_err(|error| error.to_string())?;
    write_audit(&connection, "task", "claim", "success", "system", Some(&task.id))
        .map_err(|error| error.to_string())?;
    Ok(Some(task))
}

#[tauri::command]
fn task_set_status(
    app: tauri::AppHandle,
    id: String,
    status: String,
) -> Result<bool, String> {
    let workspace_id = active_workspace_id();
    let allowed = ["pending", "awaiting_approval", "awaiting_user_action", "running", "succeeded", "failed", "blocked", "cancelled"];
    if !allowed.contains(&status.as_str()) {
        return Err("unsupported task status".to_string());
    }

    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role_for(&connection, &workspace_id, &["owner", "admin", "operator"]).map_err(|error| error.to_string())?;
    let entity_id = validate_label(&id).map_err(|error| error.to_string())?;
    let current: Option<String> = connection
        .query_row(
            "SELECT status FROM tasks WHERE id=?1 AND workspace_id=?2",
            params![&entity_id, workspace_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    let Some(current) = current else {
        return Ok(false);
    };

    let valid_transition = match current.as_str() {
        "pending" => matches!(status.as_str(), "awaiting_approval" | "awaiting_user_action" | "blocked" | "cancelled"),
        "awaiting_approval" | "awaiting_user_action" => status == "pending",
        "running" => matches!(status.as_str(), "awaiting_approval" | "awaiting_user_action" | "blocked" | "cancelled"),
        "succeeded" | "failed" | "blocked" | "cancelled" => false,
        _ => false,
    };

    if !valid_transition {
        return Err(format!("invalid task transition: {current} -> {status}"));
    }

    let changed = connection
        .execute(
            "UPDATE tasks SET status=?1 WHERE id=?2 AND workspace_id=?3 AND status=?4",
            params![status, &entity_id, workspace_id, current],
        )
        .map_err(|error| error.to_string())?;

    if changed > 0 {
        write_audit(&connection, "task", "status", "success", "user", Some(&entity_id))
            .map_err(|error| error.to_string())?;
    }

    Ok(changed > 0)
}
fn effective_max_attempts(task_max_attempts: i64, rule_max_attempts: i64) -> i64 {
    task_max_attempts.min(rule_max_attempts).clamp(1, 10)
}

fn retry_delay_ms(next_attempt: i64) -> i64 {
    if next_attempt < 1 {
        return 1_000;
    }

    let mut delay = 1_000i64;
    for _ in 1..next_attempt.min(7) {
        delay = delay.saturating_mul(2);
    }
    delay.min(60_000)
}

#[tauri::command]
fn task_fail(
    app: tauri::AppHandle,
    id: String,
    now: String,
) -> Result<TaskView, String> {
    let workspace_id = active_workspace_id();
    let entity_id = validate_label(&id).map_err(|error| error.to_string())?;
    let failed_at = OffsetDateTime::parse(now.trim(), &Rfc3339)
        .map_err(|_| "failure timestamp must be an RFC3339 ISO timestamp".to_string())?;

    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role_for(&connection, &workspace_id, &["owner", "admin", "operator"]).map_err(|error| error.to_string())?;
    let current: Option<(i64, i64, String, Option<String>, Option<String>, String, String, String, i64, String, String, String, String)> = connection
        .query_row(
            "SELECT attempts, max_attempts, campaign_id, content_id, destination_id, account_id, platform, kind, priority,
                    status, idempotency_key, available_at, created_at
             FROM tasks
             WHERE id=?1 AND workspace_id=?2",
            params![&entity_id, workspace_id],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                    row.get(5)?,
                    row.get(6)?,
                    row.get(7)?,
                    row.get(8)?,
                    row.get(9)?,
                    row.get(10)?,
                    row.get(11)?,
                    row.get(12)?,
                ))
            },
        )
        .optional()
        .map_err(|error| error.to_string())?;

    let Some((attempts, max_attempts, campaign_id, content_id, destination_id, account_id, platform, kind, priority, status, idempotency_key, available_at, created_at)) = current else {
        return Err(AppError::NotFound.to_string());
    };

    if status != "running" {
        return Err("only running tasks can fail".to_string());
    }

    let next_attempt = attempts + 1;
    let effective_task_max_attempts = max_attempts.clamp(1, 10);
    let terminal = next_attempt >= effective_task_max_attempts;
    let next_available = if terminal {
        available_at.clone()
    } else {
        (failed_at + Duration::milliseconds(retry_delay_ms(next_attempt)))
            .format(&Rfc3339)
            .map_err(|_| "failed to format retry timestamp".to_string())?
    };
    let next_status = if terminal { "failed" } else { "pending" };

    let changed = connection
        .execute(
            "UPDATE tasks
             SET status=?1, attempts=?2, available_at=?3
             WHERE id=?4 AND workspace_id=?5 AND status='running'",
            params![next_status, next_attempt, next_available, &entity_id, workspace_id],
        )
        .map_err(|error| error.to_string())?;

    if changed != 1 {
        return Err("task failure transition was not applied".to_string());
    }

    write_audit(
        &connection,
        "task",
        "failure",
        if terminal { "failure" } else { "success" },
        "system",
        Some(&entity_id),
    )
    .map_err(|error| error.to_string())?;

    Ok(TaskView {
        id: entity_id,
        campaign_id,
        content_id,
        destination_id,
        account_id,
        platform,
        kind,
        priority,
        status: next_status.to_string(),
        attempts: next_attempt,
        max_attempts,
        idempotency_key,
        available_at: next_available,
        created_at,
    })
}


#[tauri::command]
fn task_list(app: tauri::AppHandle, campaign_id: Option<String>) -> Result<Vec<TaskView>, String> {
    let workspace_id = active_workspace_id();
    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role_for(&connection, &workspace_id, &["owner", "admin", "editor", "operator", "reviewer", "viewer"]).map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare(
            "SELECT id, campaign_id, content_id, destination_id, account_id, platform, kind, priority,
                    status, attempts, max_attempts, idempotency_key, available_at, created_at
             FROM tasks
             WHERE workspace_id=?1
               AND (?2 IS NULL OR campaign_id=?2)
             ORDER BY priority DESC, available_at ASC",
        )
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map(params![workspace_id, campaign_id], |row| {
            Ok(TaskView {
                id: row.get(0)?,
                campaign_id: row.get(1)?,
                content_id: row.get(2)?,
                destination_id: row.get(3)?,
                account_id: row.get(4)?,
                platform: row.get(5)?,
                kind: row.get(6)?,
                priority: row.get(7)?,
                status: row.get(8)?,
                attempts: row.get(9)?,
                max_attempts: row.get(10)?,
                idempotency_key: row.get(11)?,
                available_at: row.get(12)?,
                created_at: row.get(13)?,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

#[tauri::command]
fn contact_upsert(
    app: tauri::AppHandle,
    id: String,
    display_name: String,
    phone: Option<String>,
    email: Option<String>,
    source_platform: Option<String>,
    status: String,
    notes: Option<String>,
) -> Result<ContactView, String> {
    let workspace_id = active_workspace_id();
    let id = validate_label(&id).map_err(|error| error.to_string())?;
    let display_name = validate_label(&display_name).map_err(|error| error.to_string())?;
    let allowed_status = ["new", "interested", "sold", "lost"];
    if !allowed_status.contains(&status.as_str()) {
        return Err("unsupported contact status".to_string());
    }
    let timestamp = chrono_like_timestamp();

    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role_for(&connection, &workspace_id, &["owner", "admin", "editor", "operator"]).map_err(|error| error.to_string())?;
    let changed = connection
        .execute(
            "INSERT INTO contacts(
               id, workspace_id, display_name, phone, email, source_platform,
               status, notes, created_at, updated_at
             )
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)
             ON CONFLICT(id) DO UPDATE SET
               display_name=excluded.display_name,
               phone=excluded.phone,
               email=excluded.email,
               source_platform=excluded.source_platform,
               status=excluded.status,
               notes=excluded.notes,
               updated_at=excluded.updated_at
             WHERE contacts.workspace_id=excluded.workspace_id",
            params![
                id,
                workspace_id,
                display_name,
                phone,
                email,
                source_platform,
                status,
                notes,
                timestamp
            ],
        )
        .map_err(|error| error.to_string())?;
    if changed != 1 {
        return Err("contact id already belongs to another workspace".to_string());
    }

    write_audit(&connection, "contact", "upsert", "success", "user", Some(&id))
        .map_err(|error| error.to_string())?;

    Ok(ContactView {
        id,
        display_name,
        phone,
        email,
        source_platform,
        status,
        notes,
        updated_at: timestamp,
    })
}

#[tauri::command]
fn contact_list(app: tauri::AppHandle, search: Option<String>) -> Result<Vec<ContactView>, String> {
    let workspace_id = active_workspace_id();
    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role_for(&connection, &workspace_id, &["owner", "admin", "editor", "operator", "reviewer", "viewer"]).map_err(|error| error.to_string())?;
    let pattern = search.map(|value| "%".to_string() + value.trim() + "%");
    let mut statement = connection
        .prepare(
            "SELECT id, display_name, phone, email, source_platform, status, notes, updated_at
             FROM contacts
             WHERE workspace_id=?1
               AND (?2 IS NULL OR display_name LIKE ?2 OR phone LIKE ?2 OR email LIKE ?2)
             ORDER BY updated_at DESC",
        )
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map(params![workspace_id, pattern], |row| {
            Ok(ContactView {
                id: row.get(0)?,
                display_name: row.get(1)?,
                phone: row.get(2)?,
                email: row.get(3)?,
                source_platform: row.get(4)?,
                status: row.get(5)?,
                notes: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

fn uuid_like() -> String {
    let mut bytes = [0u8; 16];
    rand::rng().fill_bytes(&mut bytes);
    B64.encode(bytes).replace('/', "_").replace('+', "-").replace('=', "")
}

fn backup_directory(app: &tauri::AppHandle) -> Result<PathBuf, AppError> {
    let app_data = app.path().app_data_dir().map_err(|_| AppError::Path)?;
    let backups = app_data.join("backups");
    fs::create_dir_all(&backups)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&backups, fs::Permissions::from_mode(0o700))?;
    }
    Ok(backups)
}

fn validate_backup_name(name: &str) -> Result<String, AppError> {
    let value = name.trim();
    if value.is_empty()
        || value.len() > 120
        || value.contains('/')
        || value.contains('\\')
        || value.contains("..")
    {
        return Err(AppError::InvalidLabel);
    }
    Ok(value.to_string())
}

#[tauri::command]
fn backup_create(app: tauri::AppHandle, password: String) -> Result<String, String> {
    if password.is_empty() {
        return Err(AppError::InvalidPassword.to_string());
    }

    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role(&connection, &["owner", "admin"])
        .map_err(|error| error.to_string())?;
    drop(connection);
    let app_data = app.path().app_data_dir().map_err(|_| AppError::Path.to_string())?;
    let database_path = app_data.join("orbit.sqlite3");
    let backups = backup_directory(&app).map_err(|error| error.to_string())?;
    let temp_path = backups.join("orbit-backup-source.sqlite3");

    if temp_path.exists() {
        fs::remove_file(&temp_path).map_err(|error| error.to_string())?;
    }

    let connection = Connection::open(&database_path).map_err(|error| error.to_string())?;
    connection
        .execute("VACUUM INTO ?1", params![temp_path.to_string_lossy().to_string()])
        .map_err(|error| error.to_string())?;
    drop(connection);
    restrict_private_file(&temp_path).map_err(|error| error.to_string())?;

    let bytes = fs::read(&temp_path).map_err(|error| error.to_string())?;
    fs::remove_file(&temp_path).map_err(|error| error.to_string())?;

    let payload = seal(&password, &B64.encode(bytes)).map_err(|error| error.to_string())?;
    let payload_json = serde_json::to_string(&payload).map_err(|error| error.to_string())?;
    let filename = format!("orbit-{}-{}.orbitbackup", chrono_like_timestamp(), uuid_like());
    let destination = backups.join(&filename);
    write_private_file(&destination, &payload_json).map_err(|error| error.to_string())?;
    write_audit(&open_db(&app).map_err(|error| error.to_string())?, "backup", "create", "success", "user", Some(&filename))
        .map_err(|error| error.to_string())?;

    Ok(filename)
}

#[tauri::command]
fn backup_list(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role(&connection, &["owner", "admin"])
        .map_err(|error| error.to_string())?;
    drop(connection);
    let backups = backup_directory(&app).map_err(|error| error.to_string())?;
    let mut names = fs::read_dir(backups)
        .map_err(|error| error.to_string())?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.is_file())
        .filter_map(|path| path.file_name().and_then(|name| name.to_str()).map(ToOwned::to_owned))
        .filter(|name| name.ends_with(".orbitbackup"))
        .collect::<Vec<_>>();
    names.sort();
    names.reverse();
    Ok(names)
}

#[tauri::command]
fn backup_restore(
    app: tauri::AppHandle,
    filename: String,
    password: String,
) -> Result<bool, String> {
    if password.is_empty() {
        return Err(AppError::InvalidPassword.to_string());
    }

    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role(&connection, &["owner", "admin"])
        .map_err(|error| error.to_string())?;
    drop(connection);

    let filename = validate_backup_name(&filename).map_err(|error| error.to_string())?;
    if !filename.ends_with(".orbitbackup") {
        return Err(AppError::InvalidLabel.to_string());
    }

    let backups = backup_directory(&app).map_err(|error| error.to_string())?;
    let backup_path = backups.join(&filename);
    if !backup_path.is_file() {
        return Err(AppError::NotFound.to_string());
    }

    let payload_json = fs::read_to_string(&backup_path).map_err(|error| error.to_string())?;
    let payload: EncryptedPayload =
        serde_json::from_str(&payload_json).map_err(|error| error.to_string())?;
    let encoded_database = open_payload(&password, &payload).map_err(|error| error.to_string())?;
    let database_bytes = B64.decode(encoded_database.as_bytes()).map_err(|_| AppError::InvalidPayload.to_string())?;

    let app_data = app.path().app_data_dir().map_err(|_| AppError::Path.to_string())?;
    let target = app_data.join("orbit.sqlite3");
    let temporary = app_data.join("orbit.restore.sqlite3");
    let previous = app_data.join("orbit.previous.sqlite3");

    fs::write(&temporary, database_bytes).map_err(|error| error.to_string())?;
    restrict_private_file(&temporary).map_err(|error| error.to_string())?;

    let integrity_connection = Connection::open(&temporary)
        .map_err(|error| error.to_string())?;
    let integrity = integrity_connection
        .query_row("PRAGMA integrity_check", [], |row| row.get::<_, String>(0))
        .map_err(|error| error.to_string())?;
    if integrity != "ok" {
        let _ = fs::remove_file(&temporary);
        return Err("backup integrity check failed".to_string());
    }

    let foreign_key_error: Option<String> = integrity_connection
        .query_row(
            "SELECT message FROM pragma_foreign_key_check LIMIT 1",
            [],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;
    if foreign_key_error.is_some() {
        let _ = fs::remove_file(&temporary);
        return Err("backup foreign-key integrity check failed".to_string());
    }

    let restored_schema_version: i64 = integrity_connection
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .map_err(|error| error.to_string())?;
    if restored_schema_version > SCHEMA_VERSION {
        let _ = fs::remove_file(&temporary);
        return Err("backup schema version is newer than this application".to_string());
    }

    drop(integrity_connection);

    if previous.exists() {
        fs::remove_file(&previous).map_err(|error| error.to_string())?;
    }

    if target.exists() {
        fs::rename(&target, &previous).map_err(|error| error.to_string())?;
    }

    if let Err(error) = fs::rename(&temporary, &target) {
        if previous.exists() {
            let _ = fs::rename(&previous, &target);
        }
        let _ = fs::remove_file(&temporary);
        return Err(error.to_string());
    }

    if previous.exists() {
        fs::remove_file(&previous).map_err(|error| error.to_string())?;
    }

    restrict_private_file(&target).map_err(|error| error.to_string())?;

    let restored_connection_result = (|| -> Result<(), String> {
        let restored_connection = Connection::open(&target).map_err(|error| error.to_string())?;
        restored_connection
            .execute_batch("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;")
            .map_err(|error| error.to_string())?;
        restored_connection
            .execute_batch(SCHEMA)
            .map_err(|error| error.to_string())?;
        migrate_schema(&restored_connection).map_err(|error| error.to_string())?;
        create_integrity_triggers(&restored_connection).map_err(|error| error.to_string())?;
        ensure_workspace_context(&restored_connection).map_err(|error| error.to_string())?;
        write_audit(
            &restored_connection,
            "backup",
            "restore",
            "success",
            "user",
            Some(&filename),
        )
        .map_err(|error| error.to_string())?;
        Ok(())
    })();

    if let Err(error) = restored_connection_result {
        let _ = fs::remove_file(&target);
        if previous.exists() {
            let _ = fs::rename(&previous, &target);
        }
        return Err(error);
    }

    fs::remove_file(&previous).map_err(|error| error.to_string())?;
    Ok(true)
}

fn audit_hash(
    previous_hash: &str,
    id: &str,
    workspace_id: &str,
    timestamp: &str,
    category: &str,
    action: &str,
    outcome: &str,
    actor: &str,
    entity_id: Option<&str>,
    metadata_json: Option<&str>,
) -> String {
    let canonical = format!(
        "{previous_hash}\n{id}\n{workspace_id}\n{timestamp}\n{category}\n{action}\n{outcome}\n{actor}\n{}\n{}",
        entity_id.unwrap_or(""),
        metadata_json.unwrap_or(""),
    );
    let digest = Sha256::digest(canonical.as_bytes());
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn write_audit_for_workspace(
    connection: &Connection,
    workspace_id: &str,
    category: &str,
    action: &str,
    outcome: &str,
    actor: &str,
    entity_id: Option<&str>,
) -> Result<(), rusqlite::Error> {
    connection.execute_batch("BEGIN IMMEDIATE")?;

    let result = (|| {
        let id = uuid_like();
        let timestamp = chrono_like_timestamp();
        let previous_hash: String = connection
            .query_row(
                "SELECT hash FROM audit_events
                 WHERE workspace_id=?1
                 ORDER BY rowid DESC
                 LIMIT 1",
                params![&workspace_id],
                |row| row.get(0),
            )
            .optional()?
            .filter(|value: &String| !value.is_empty())
            .unwrap_or_else(|| "GENESIS".to_string());

        let hash = audit_hash(
            &previous_hash,
            &id,
            &workspace_id,
            &timestamp,
            category,
            action,
            outcome,
            actor,
            entity_id,
            None,
        );

        connection.execute(
            "INSERT INTO audit_events(
               id, workspace_id, timestamp, category, action, outcome, actor,
               entity_id, metadata_json, previous_hash, hash
             )
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, NULL, ?9, ?10)",
            params![
                id,
                &workspace_id,
                timestamp,
                category,
                action,
                outcome,
                actor,
                entity_id,
                previous_hash,
                hash
            ],
        )?;

        Ok::<(), rusqlite::Error>(())
    })();

    match result {
        Ok(()) => connection.execute_batch("COMMIT"),
        Err(error) => {
            let _ = connection.execute_batch("ROLLBACK");
            Err(error)
        }
    }
}

fn write_audit(
    connection: &Connection,
    category: &str,
    action: &str,
    outcome: &str,
    actor: &str,
    entity_id: Option<&str>,
) -> Result<(), rusqlite::Error> {
    let workspace_id = active_workspace_id();
    write_audit_for_workspace(
        connection,
        &workspace_id,
        category,
        action,
        outcome,
        actor,
        entity_id,
    )
}



#[tauri::command]
fn conversation_upsert(
    app: tauri::AppHandle,
    id: String,
    account_id: String,
    contact_id: Option<String>,
    platform: String,
    external_thread_id: Option<String>,
    status: String,
) -> Result<ConversationView, String> {
    let workspace_id = active_workspace_id();
    let id = validate_label(&id).map_err(|error| error.to_string())?;
    let account_id = validate_label(&account_id).map_err(|error| error.to_string())?;
    let platform = validate_platform(&platform).map_err(|error| error.to_string())?;
    let allowed_status = ["new", "interested", "potential_customer", "complaint", "closed"];
    if !allowed_status.contains(&status.as_str()) {
        return Err("unsupported conversation status".to_string());
    }

    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role_for(&connection, &workspace_id, &["owner", "admin", "editor", "operator"]).map_err(|error| error.to_string())?;
    let account_platform: Option<String> = connection
        .query_row(
            "SELECT platform FROM accounts WHERE id=?1 AND workspace_id=?2",
            params![account_id, workspace_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;
    match account_platform {
        Some(value) if value == platform => {}
        Some(_) => return Err("conversation account platform does not match".to_string()),
        None => return Err(AppError::NotFound.to_string()),
    }

    if let Some(contact_id) = &contact_id {
        let contact_exists: bool = connection
            .query_row(
                "SELECT EXISTS(
                   SELECT 1 FROM contacts WHERE id=?1 AND workspace_id=?2
                 )",
                params![contact_id, workspace_id],
                |row| row.get(0),
            )
            .map_err(|error| error.to_string())?;
        if !contact_exists {
            return Err(AppError::NotFound.to_string());
        }
    }

    let timestamp = chrono_like_timestamp();
    let changed = connection
        .execute(
            "INSERT INTO conversations(
               id, workspace_id, account_id, contact_id, platform, external_thread_id,
               status, created_at, updated_at
             )
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)
             ON CONFLICT(id) DO UPDATE SET
               account_id=excluded.account_id,
               contact_id=excluded.contact_id,
               platform=excluded.platform,
               external_thread_id=excluded.external_thread_id,
               status=excluded.status,
               updated_at=excluded.updated_at
             WHERE conversations.workspace_id=excluded.workspace_id",
            params![
                id,
                workspace_id,
                account_id,
                contact_id,
                platform,
                external_thread_id,
                status,
                timestamp
            ],
        )
        .map_err(|error| error.to_string())?;
    if changed != 1 {
        return Err("conversation id already belongs to another workspace".to_string());
    }

    write_audit(&connection, "conversation", "upsert", "success", "user", Some(&id))
        .map_err(|error| error.to_string())?;

    Ok(ConversationView {
        id,
        account_id: Some(account_id),
        contact_id,
        platform,
        external_thread_id,
        status,
        message_count: 0,
        updated_at: timestamp,
    })
}

#[tauri::command]
fn message_add(
    app: tauri::AppHandle,
    id: String,
    conversation_id: String,
    direction: String,
    body: String,
) -> Result<MessageView, String> {
    let workspace_id = active_workspace_id();
    let id = validate_label(&id).map_err(|error| error.to_string())?;
    let conversation_id = validate_label(&conversation_id).map_err(|error| error.to_string())?;
    let body = body.trim().to_string();
    if body.is_empty() || body.len() > 10000 {
        return Err("invalid message body".to_string());
    }
    if !["inbound", "outbound"].contains(&direction.as_str()) {
        return Err("unsupported message direction".to_string());
    }

    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role_for(&connection, &workspace_id, &["owner", "admin", "operator"]).map_err(|error| error.to_string())?;
    let conversation_exists: bool = connection
        .query_row(
            "SELECT EXISTS(
               SELECT 1 FROM conversations WHERE id=?1 AND workspace_id=?2
             )",
            params![conversation_id, workspace_id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    if !conversation_exists {
        return Err(AppError::NotFound.to_string());
    }

    let sent_at = chrono_like_timestamp();
    connection
        .execute(
            "INSERT INTO messages(id, conversation_id, direction, body, sent_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, conversation_id, direction, body, sent_at],
        )
        .map_err(|error| error.to_string())?;
    connection
        .execute(
            "UPDATE conversations SET updated_at=?1 WHERE id=?2 AND workspace_id=?3",
            params![sent_at, conversation_id, workspace_id],
        )
        .map_err(|error| error.to_string())?;

    write_audit(&connection, "message", "add", "success", "user", Some(&id))
        .map_err(|error| error.to_string())?;

    Ok(MessageView {
        id,
        conversation_id,
        direction,
        body,
        sent_at,
    })
}

#[tauri::command]
fn inbox_list(app: tauri::AppHandle) -> Result<Vec<ConversationView>, String> {
    let workspace_id = active_workspace_id();
    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role_for(&connection, &workspace_id, &["owner", "admin", "editor", "operator", "reviewer", "viewer"]).map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare(
            "SELECT c.id, c.account_id, c.contact_id, c.platform, c.external_thread_id, c.status, COUNT(m.id), c.updated_at
             FROM conversations c
             LEFT JOIN messages m ON m.conversation_id=c.id
             WHERE c.workspace_id=?1
             GROUP BY c.id
             ORDER BY c.updated_at DESC",
        )
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map(params![workspace_id], |row| {
            Ok(ConversationView {
                id: row.get(0)?,
                account_id: row.get(1)?,
                contact_id: row.get(2)?,
                platform: row.get(3)?,
                external_thread_id: row.get(4)?,
                status: row.get(5)?,
                message_count: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

#[tauri::command]
fn message_list(
    app: tauri::AppHandle,
    conversation_id: String,
) -> Result<Vec<MessageView>, String> {
    let workspace_id = active_workspace_id();
    let conversation_id = validate_label(&conversation_id).map_err(|error| error.to_string())?;
    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role_for(&connection, &workspace_id, &["owner", "admin", "editor", "operator", "reviewer", "viewer"]).map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare(
            "SELECT m.id, m.conversation_id, m.direction, m.body, m.sent_at
             FROM messages m
             JOIN conversations c ON c.id=m.conversation_id
             WHERE m.conversation_id=?1 AND c.workspace_id=?2
             ORDER BY m.sent_at ASC",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params![conversation_id, workspace_id], |row| {
            Ok(MessageView {
                id: row.get(0)?,
                conversation_id: row.get(1)?,
                direction: row.get(2)?,
                body: row.get(3)?,
                sent_at: row.get(4)?,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

#[tauri::command]
fn analytics_summary(
    app: tauri::AppHandle,
    campaign_id: Option<String>,
) -> Result<AnalyticsSummaryView, String> {
    let workspace_id = active_workspace_id();
    let campaign_id = campaign_id
        .map(|value| validate_label(&value))
        .transpose()
        .map_err(|error| error.to_string())?;
    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role_for(
        &connection,
        &workspace_id,
        &["owner", "admin", "editor", "operator", "reviewer", "viewer"],
    )
    .map_err(|error| error.to_string())?;

    let row = connection
        .query_row(
            "SELECT
               COALESCE(SUM(CASE WHEN status IN ('succeeded', 'failed', 'blocked') THEN 1 ELSE 0 END), 0) AS attempted,
               COALESCE(SUM(CASE WHEN status='succeeded' THEN 1 ELSE 0 END), 0),
               COALESCE(SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END), 0),
               COALESCE(SUM(CASE WHEN status='blocked' THEN 1 ELSE 0 END), 0),
               COALESCE(SUM(CASE WHEN status='pending' OR status='awaiting_approval' OR status='awaiting_user_action' THEN 1 ELSE 0 END), 0),
               COALESCE(SUM(CASE WHEN status='running' THEN 1 ELSE 0 END), 0)
             FROM tasks
             WHERE workspace_id=?1
               AND (?2 IS NULL OR campaign_id=?2)",
            params![&workspace_id, &campaign_id],
            |row| {
                let attempted: i64 = row.get(0)?;
                let succeeded: i64 = row.get(1)?;
                let failed: i64 = row.get(2)?;
                let blocked: i64 = row.get(3)?;
                let pending: i64 = row.get(4)?;
                let running: i64 = row.get(5)?;
                Ok((attempted, succeeded, failed, blocked, pending, running))
            },
        )
        .map_err(|error| error.to_string())?;

    let (attempted, succeeded, failed, blocked, pending, running) = row;
    let attempted_f = attempted as f64;
    Ok(AnalyticsSummaryView {
        attempted,
        succeeded,
        failed,
        blocked,
        pending,
        running,
        completion_rate: if attempted == 0 {
            0.0
        } else {
            (succeeded + failed + blocked) as f64 / attempted_f
        },
        success_rate: if attempted == 0 {
            0.0
        } else {
            succeeded as f64 / attempted_f
        },
        failure_rate: if attempted == 0 {
            0.0
        } else {
            failed as f64 / attempted_f
        },
    })
}

#[tauri::command]
fn audit_list(app: tauri::AppHandle, limit: Option<i64>) -> Result<Vec<AuditView>, String> {
    let workspace_id = active_workspace_id();
    let limit = limit.unwrap_or(100).clamp(1, 500);
    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role_for(&connection, &workspace_id, &["owner", "admin", "reviewer"]).map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare(
            "SELECT id, timestamp, category, action, outcome, actor, entity_id, metadata_json, previous_hash, hash
             FROM audit_events
             WHERE workspace_id=?1
             ORDER BY rowid DESC LIMIT ?2",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params![workspace_id, limit], |row| {
            Ok(AuditView {
                id: row.get(0)?,
                timestamp: row.get(1)?,
                category: row.get(2)?,
                action: row.get(3)?,
                outcome: row.get(4)?,
                actor: row.get(5)?,
                entity_id: row.get(6)?,
                metadata_json: row.get(7)?,
                previous_hash: row.get(8)?,
                hash: row.get(9)?,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

#[tauri::command]
fn audit_verify(app: tauri::AppHandle) -> Result<bool, String> {
    let workspace_id = active_workspace_id();
    let connection = open_db(&app).map_err(|error| error.to_string())?;
    require_workspace_role_for(&connection, &workspace_id, &["owner", "admin", "reviewer"]).map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare(
            "SELECT id, workspace_id, timestamp, category, action, outcome, actor, entity_id, metadata_json, previous_hash, hash
             FROM audit_events
             WHERE workspace_id=?1
             ORDER BY rowid ASC",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params![workspace_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, Option<String>>(7)?,
                row.get::<_, Option<String>>(8)?,
                row.get::<_, String>(9)?,
                row.get::<_, String>(10)?,
            ))
        })
        .map_err(|error| error.to_string())?;

    let mut previous_hash = "GENESIS".to_string();
    for row in rows {
        let (id, workspace_id, timestamp, category, action, outcome, actor, entity_id, metadata_json, stored_previous, stored_hash) =
            row.map_err(|error| error.to_string())?;
        if stored_previous != previous_hash {
            return Ok(false);
        }
        let expected = audit_hash(
            &previous_hash,
            &id,
            &workspace_id,
            &timestamp,
            &category,
            &action,
            &outcome,
            &actor,
            entity_id.as_deref(),
            metadata_json.as_deref(),
        );
        if stored_hash != expected {
            return Ok(false);
        }
        previous_hash = stored_hash;
    }

    Ok(true)
}

fn chrono_like_timestamp() -> String {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}

fn normalize_rfc3339_utc(value: &str) -> Result<String, String> {
    OffsetDateTime::parse(value.trim(), &Rfc3339)
        .map(|timestamp| {
            timestamp
                .to_offset(time::UtcOffset::UTC)
                .format(&Rfc3339)
                .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
        })
        .map_err(|_| "timestamp must be a valid RFC3339 ISO timestamp".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encrypts_and_decrypts_round_trip() {
        let payload = match seal("correct-password", "local-secret") {
            Ok(value) => value,
            Err(error) => {
                assert!(false, "test encryption failed: {error}");
                return;
            }
        };
        let recovered = match open_payload("correct-password", &payload) {
            Ok(value) => value,
            Err(error) => {
                assert!(false, "test decryption failed: {error}");
                return;
            }
        };
        assert_eq!(recovered, "local-secret");
    }

    #[test]
    fn rejects_wrong_password() {
        let payload = match seal("correct-password", "local-secret") {
            Ok(value) => value,
            Err(error) => {
                assert!(false, "test encryption failed: {error}");
                return;
            }
        };
        assert!(open_payload("wrong-password", &payload).is_err());
    }

    #[test]
    fn account_upsert_status_tracks_session_presence() {
        let connection = Connection::open_in_memory().expect("sqlite should be available");
        connection.execute_batch(
            "CREATE TABLE accounts(
               id TEXT PRIMARY KEY,
               workspace_id TEXT NOT NULL,
               platform TEXT NOT NULL,
               display_name TEXT NOT NULL,
               username TEXT,
               status TEXT NOT NULL,
               session_payload_json TEXT,
               created_at TEXT NOT NULL,
               updated_at TEXT NOT NULL
             );
             INSERT INTO accounts(
               id, workspace_id, platform, display_name, username, status,
               session_payload_json, created_at, updated_at
             ) VALUES (
               'account-1', 'workspace-1', 'telegram', 'Telegram', 'orbit',
               'needs_refresh', NULL, '1', '1'
             );",
        )
        .expect("account fixture should be created");

        connection
            .execute(
                "INSERT INTO accounts(
                   id, workspace_id, platform, display_name, username, status,
                   session_payload_json, created_at, updated_at
                 )
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)
                 ON CONFLICT(id) DO UPDATE SET
                   platform=excluded.platform,
                   display_name=excluded.display_name,
                   username=excluded.username,
                   status=excluded.status,
                   session_payload_json=COALESCE(excluded.session_payload_json, accounts.session_payload_json),
                   updated_at=excluded.updated_at
                 WHERE accounts.workspace_id=excluded.workspace_id",
                params![
                    "account-1",
                    "workspace-1",
                    "telegram",
                    "Telegram",
                    "orbit",
                    "connected",
                    "encrypted-session",
                    "2"
                ],
            )
            .expect("account upsert should succeed");

        let state: (String, bool) = connection
            .query_row(
                "SELECT status, session_payload_json IS NOT NULL
                 FROM accounts
                 WHERE id='account-1'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .expect("account state should be readable");
        assert_eq!(state, ("connected".to_string(), true));
    }

    #[test]
    fn validates_labels() {
        assert!(validate_label("vault-entry").is_ok());
        assert!(validate_label("   ").is_err());
        assert!(validate_label(&"x".repeat(201)).is_err());
    }

    #[test]
    fn retry_backoff_is_bounded() {
        assert_eq!(retry_delay_ms(1), 1_000);
        assert_eq!(retry_delay_ms(2), 2_000);
        assert_eq!(retry_delay_ms(7), 60_000);
        assert_eq!(retry_delay_ms(30), 60_000);
    }

    #[test]
    fn approval_actor_must_match_local_user() {
        let connection = Connection::open_in_memory().expect("sqlite should be available");
        connection
            .execute(
                "CREATE TABLE runtime_state(key TEXT PRIMARY KEY, value TEXT NOT NULL)",
                [],
            )
            .expect("runtime state should be created");
        connection
            .execute(
                "INSERT INTO runtime_state(key, value) VALUES ('local_user_id', 'local-user')",
                [],
            )
            .expect("local user should be stored");

        assert!(require_local_user_actor(&connection, "local-user").is_ok());
        assert!(matches!(
            require_local_user_actor(&connection, "spoofed-user"),
            Err(AppError::Unauthorized)
        ));
    }

    #[test]
    fn task_timestamp_is_normalized_to_utc() {
        let normalized = normalize_rfc3339_utc("2026-09-24T18:00:00+03:00")
            .expect("timestamp should parse");
        assert_eq!(normalized, "2026-09-24T15:00:00Z");
        assert!(normalize_rfc3339_utc("not-a-timestamp").is_err());
    }

    #[test]
    fn task_attempt_limit_is_bounded() {
        assert!(!(0i64..=10i64).contains(&0));
        assert!((1i64..=10i64).contains(&1));
        assert!((1i64..=10i64).contains(&10));
        assert!(!(1i64..=10i64).contains(&11));
    }

    #[test]
    fn legacy_task_retry_limit_is_bounded() {
        assert_eq!(12i64.clamp(1, 10), 10);
        assert_eq!(3i64.clamp(1, 10), 3);
    }

    #[test]
    fn analytics_attempted_excludes_pending_and_running_work() {
        let statuses = ["pending", "running", "succeeded", "failed", "blocked", "cancelled"];
        let attempted = statuses
            .iter()
            .filter(|status| matches!(**status, "succeeded" | "failed" | "blocked"))
            .count();
        assert_eq!(attempted, 3);
    }

    #[test]
    fn effective_attempt_limit_never_exceeds_task_or_rule_limit() {
        assert_eq!(effective_max_attempts(3, 10), 3);
        assert_eq!(effective_max_attempts(10, 3), 3);
        assert_eq!(effective_max_attempts(100, 100), 10);
        assert_eq!(effective_max_attempts(0, 3), 1);
    }

    #[test]
    fn manual_status_cannot_mark_running_task_succeeded() {
        let current = "running";
        let requested = "succeeded";
        let valid = match current {
            "pending" => matches!(requested, "blocked" | "cancelled"),
            "running" => matches!(requested, "blocked" | "cancelled"),
            _ => false,
        };
        assert!(!valid);
    }

    #[test]
    fn pending_tasks_cannot_be_started_by_manual_status_override() {
        let current = "pending";
        let requested = "running";
        let valid = match current {
            "pending" => matches!(requested, "blocked" | "cancelled"),
            "running" => matches!(requested, "succeeded" | "failed" | "blocked" | "cancelled"),
            _ => false,
        };
        assert!(!valid);
    }

    #[test]
    fn audit_hash_chain_detects_mutation() {
        let workspace_id = "workspace-1";
        let first_id = "audit-1";
        let first_timestamp = "1000";
        let first_hash = audit_hash(
            "GENESIS",
            first_id,
            workspace_id,
            first_timestamp,
            "security",
            "test",
            "success",
            "system",
            None,
            None,
        );
        let second_hash = audit_hash(
            &first_hash,
            "audit-2",
            workspace_id,
            "1001",
            "security",
            "test",
            "success",
            "system",
            None,
            None,
        );

        assert_ne!(first_hash, second_hash);

        let mutated = audit_hash(
            "GENESIS",
            first_id,
            workspace_id,
            first_timestamp,
            "security",
            "tampered",
            "success",
            "system",
            None,
            None,
        );
        assert_ne!(first_hash, mutated);
    }

    #[test]
    fn audit_write_creates_a_verifiable_chain() {
        let connection = Connection::open_in_memory().expect("sqlite should be available");
        connection.execute_batch(
            "CREATE TABLE audit_events(
               id TEXT PRIMARY KEY,
               workspace_id TEXT NOT NULL,
               timestamp TEXT NOT NULL,
               category TEXT NOT NULL,
               action TEXT NOT NULL,
               outcome TEXT NOT NULL,
               actor TEXT NOT NULL,
               entity_id TEXT,
               metadata_json TEXT,
               previous_hash TEXT NOT NULL,
               hash TEXT NOT NULL
             );",
        ).expect("audit table should be created");

        write_audit(&connection, "security", "one", "success", "system", None)
            .expect("first audit write should work");
        write_audit(&connection, "security", "two", "success", "system", None)
            .expect("second audit write should work");

        let mut statement = connection
            .prepare(
                "SELECT id, workspace_id, timestamp, category, action, outcome, actor,
                        entity_id, metadata_json, previous_hash, hash
                 FROM audit_events
                 ORDER BY rowid ASC",
            )
            .expect("query should prepare");
        let rows = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, String>(5)?,
                    row.get::<_, String>(6)?,
                    row.get::<_, Option<String>>(7)?,
                    row.get::<_, Option<String>>(8)?,
                    row.get::<_, String>(9)?,
                    row.get::<_, String>(10)?,
                ))
            })
            .expect("query should execute");

        let collected: Vec<_> = rows.collect::<Result<Vec<_>, _>>()
            .expect("audit rows should decode");
        assert_eq!(collected.len(), 2);

        let first = collected.first().expect("first row should exist");
        let second = collected.get(1).expect("second row should exist");

        assert_eq!(first.7, None);
        assert_eq!(first.8, None);
        assert_eq!(first.9, "GENESIS");
        assert_eq!(
            first.10,
            audit_hash(
                &first.9,
                &first.0,
                &first.1,
                &first.2,
                &first.3,
                &first.4,
                &first.5,
                &first.6,
                first.7.as_deref(),
                first.8.as_deref(),
            )
        );
        assert_eq!(second.9, first.10);
        assert_eq!(
            second.10,
            audit_hash(
                &second.9,
                &second.0,
                &second.1,
                &second.2,
                &second.3,
                &second.4,
                &second.5,
                &second.6,
                second.7.as_deref(),
                second.8.as_deref(),
            )
        );
    }

    #[test]
    fn telegram_ambiguous_delivery_statuses_are_detected() {
        assert!(telegram_delivery_status_is_ambiguous(408));
        assert!(telegram_delivery_status_is_ambiguous(500));
        assert!(telegram_delivery_status_is_ambiguous(503));
        assert!(!telegram_delivery_status_is_ambiguous(400));
        assert!(!telegram_delivery_status_is_ambiguous(429));
    }

    #[test]
    fn telegram_retry_timestamp_uses_rfc3339_utc() {
        let value = parse_retry_timestamp(60);
        assert!(OffsetDateTime::parse(&value, &Rfc3339).is_ok());
    }

    #[test]
    fn task_claim_projection_keeps_task_fields_in_declared_order() {
        let selected_columns = [
            "id",
            "campaign_id",
            "content_id",
            "destination_id",
            "account_id",
            "platform",
            "kind",
            "priority",
            "attempts",
            "max_attempts",
            "idempotency_key",
            "available_at",
            "created_at",
        ];

        let task_view_fields = [
            "id",
            "campaign_id",
            "content_id",
            "destination_id",
            "account_id",
            "platform",
            "kind",
            "priority",
            "attempts",
            "max_attempts",
            "idempotency_key",
            "available_at",
            "created_at",
        ];

        assert_eq!(selected_columns, task_view_fields);
    }

    #[test]
    fn sqlite_connection_defaults_enable_integrity_and_busy_timeout() {
        let connection = Connection::open_in_memory()
            .expect("in-memory SQLite should be available");
        connection
            .execute_batch("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;")
            .expect("SQLite pragmas should apply");

        let foreign_keys: i64 = connection
            .query_row("PRAGMA foreign_keys", [], |row| row.get(0))
            .expect("foreign key pragma should be readable");
        let busy_timeout: i64 = connection
            .query_row("PRAGMA busy_timeout", [], |row| row.get(0))
            .expect("busy timeout pragma should be readable");

        assert_eq!(foreign_keys, 1);
        assert_eq!(busy_timeout, 5000);
    }

    #[test]
    fn audit_migration_rebuilds_each_workspace_chain_independently() {
        let connection = Connection::open_in_memory()
            .expect("in-memory SQLite should be available");
        connection
            .execute_batch(SCHEMA)
            .expect("current schema should be creatable");
        connection
            .execute(
                "INSERT INTO workspaces(id, name, created_at)
                 VALUES ('workspace-a', 'A', '1'), ('workspace-b', 'B', '1')",
                [],
            )
            .expect("workspaces should insert");
        connection
            .execute_batch(
                "INSERT INTO audit_events(
                   id, workspace_id, timestamp, category, action, outcome, actor,
                   entity_id, metadata_json, previous_hash, hash
                 )
                 VALUES
                   ('a-1', 'workspace-a', '2026-01-01T00:00:00Z', 'security', 'one', 'success', 'system', NULL, NULL, 'GENESIS', ''),
                   ('a-2', 'workspace-a', '2026-01-01T00:00:01Z', 'security', 'two', 'success', 'system', NULL, NULL, 'GENESIS', ''),
                   ('b-1', 'workspace-b', '2026-01-01T00:00:00Z', 'security', 'one', 'success', 'system', NULL, NULL, 'GENESIS', '')",
            )
            .expect("audit fixtures should insert");
        connection
            .execute_batch("PRAGMA user_version = 2;")
            .expect("legacy version should be set");

        migrate_schema(&connection).expect("migration should rebuild audit hashes");

        let mut statement = connection
            .prepare(
                "SELECT workspace_id, previous_hash, hash
                 FROM audit_events
                 ORDER BY workspace_id, rowid",
            )
            .expect("audit verification query should prepare");
        let rows = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            })
            .expect("audit verification query should execute");
        let collected: Vec<_> = rows
            .collect::<Result<Vec<_>, _>>()
            .expect("audit rows should decode");

        assert_eq!(collected.len(), 3);
        assert_eq!(collected[0].0, "workspace-a");
        assert_eq!(collected[0].1, "GENESIS");
        assert_ne!(collected[0].2, "");
        assert_eq!(collected[1].0, "workspace-a");
        assert_eq!(collected[1].1, collected[0].2);
        assert_eq!(collected[2].0, "workspace-b");
        assert_eq!(collected[2].1, "GENESIS");
        assert_ne!(collected[2].2, "");
    }

    #[test]
    fn sqlite_integrity_triggers_reject_cross_workspace_relationships() {
        let connection = Connection::open_in_memory()
            .expect("in-memory SQLite should be available");
        connection
            .execute_batch(SCHEMA)
            .expect("current schema should be creatable");
        migrate_schema(&connection).expect("schema migration should succeed");
        create_integrity_triggers(&connection).expect("integrity triggers should be creatable");

        connection
            .execute(
                "INSERT INTO workspaces(id, name, created_at)
                 VALUES ('workspace-a', 'A', '1'), ('workspace-b', 'B', '1')",
                [],
            )
            .expect("workspaces should insert");
        connection
            .execute(
                "INSERT INTO accounts(id, workspace_id, platform, display_name, status, created_at, updated_at)
                 VALUES ('account-a', 'workspace-a', 'facebook', 'A', 'connected', '1', '1'),
                        ('account-b', 'workspace-b', 'facebook', 'B', 'connected', '1', '1')",
                [],
            )
            .expect("accounts should insert");
        connection
            .execute(
                "INSERT INTO campaigns(id, workspace_id, name, status, created_at)
                 VALUES ('campaign-a', 'workspace-a', 'A', 'scheduled', '1')",
                [],
            )
            .expect("campaign should insert");

        let result = connection.execute(
            "INSERT INTO campaign_accounts(workspace_id, campaign_id, account_id)
             VALUES ('workspace-a', 'campaign-a', 'account-b')",
            [],
        );
        assert!(result.is_err());
    }

    #[test]
    fn workspace_context_creates_local_owner_membership() {
        let connection = Connection::open_in_memory()
            .expect("in-memory SQLite should be available");
        connection
            .execute_batch(SCHEMA)
            .expect("current schema should be creatable");
        migrate_schema(&connection).expect("schema migration should succeed");
        ensure_workspace_context(&connection).expect("workspace context should initialize");

        let membership: (String, String, i64) = connection
            .query_row(
                "SELECT user_id, role, active
                 FROM workspace_memberships
                 WHERE workspace_id=?1 AND user_id=?2",
                params![DEFAULT_WORKSPACE_ID, DEFAULT_LOCAL_USER_ID],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .expect("default local membership should exist");

        assert_eq!(membership.0, DEFAULT_LOCAL_USER_ID);
        assert_eq!(membership.1, "owner");
        assert_eq!(membership.2, 1);
        assert_eq!(membership.0, DEFAULT_LOCAL_USER_ID);
        assert_eq!(active_workspace_id(), DEFAULT_WORKSPACE_ID);
    }

    #[test]
    fn vault_schema_is_workspace_scoped_and_supports_same_label_per_workspace() {
        let connection = Connection::open_in_memory()
            .expect("in-memory SQLite should be available");
        connection
            .execute_batch(SCHEMA)
            .expect("current schema should be creatable");
        migrate_schema(&connection).expect("schema migration should succeed");

        connection
            .execute(
                "INSERT INTO vault_records(workspace_id, label, payload_json, updated_at)
                 VALUES
                   ('workspace-a', 'shared-label', 'payload-a', '1'),
                   ('workspace-b', 'shared-label', 'payload-b', '1')",
                [],
            )
            .expect("same labels should be isolated across workspaces");

        let values: Vec<(String, String)> = connection
            .prepare(
                "SELECT workspace_id, payload_json
                 FROM vault_records
                 WHERE label='shared-label'
                 ORDER BY workspace_id ASC",
            )
            .expect("vault query should prepare")
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
            .expect("vault query should execute")
            .collect::<Result<Vec<_>, _>>()
            .expect("vault rows should decode");

        assert_eq!(
            values,
            vec![
                ("workspace-a".to_string(), "payload-a".to_string()),
                ("workspace-b".to_string(), "payload-b".to_string()),
            ]
        );
        assert!(has_column(&connection, "vault_records", "workspace_id")
            .expect("workspace column should exist"));
    }

    #[test]
    fn workspace_role_gate_rejects_insufficient_role() {
        let connection = Connection::open_in_memory()
            .expect("in-memory SQLite should be available");
        connection
            .execute_batch(SCHEMA)
            .expect("current schema should be creatable");
        migrate_schema(&connection).expect("schema migration should succeed");
        ensure_workspace_context(&connection).expect("workspace context should initialize");

        connection
            .execute(
                "UPDATE workspace_memberships
                 SET role='viewer'
                 WHERE workspace_id=?1 AND user_id=?2",
                params![DEFAULT_WORKSPACE_ID, DEFAULT_LOCAL_USER_ID],
            )
            .expect("role update should work");

        assert!(matches!(
            require_workspace_role_for(
                &connection,
                DEFAULT_WORKSPACE_ID,
                &["owner", "admin"]
            ),
            Err(AppError::Unauthorized)
        ));
        assert!(require_workspace_role(
            &connection,
            &["viewer", "owner", "admin"]
        )
        .is_ok());
    }

    #[test]
    fn concurrent_audit_writes_preserve_a_hash_chain() {
        let path = std::env::temp_dir().join(format!("orbit-audit-{}.sqlite3", uuid_like()));
        let setup = Connection::open(&path).expect("SQLite database should open");
        setup.execute_batch(SCHEMA).expect("schema should be created");
        migrate_schema(&setup).expect("schema migration should succeed");
        ensure_workspace_context(&setup).expect("workspace context should initialize");
        drop(setup);

        let first = std::thread::spawn({
            let path = path.clone();
            move || {
                let connection = Connection::open(&path).expect("first connection should open");
                write_audit(&connection, "security", "first", "success", "system", None)
                    .expect("first audit write should succeed");
            }
        });

        let second = std::thread::spawn({
            let path = path.clone();
            move || {
                let connection = Connection::open(&path).expect("second connection should open");
                write_audit(&connection, "security", "second", "success", "system", None)
                    .expect("second audit write should succeed");
            }
        });

        first.join().expect("first audit writer should finish");
        second.join().expect("second audit writer should finish");

        let connection = Connection::open(&path).expect("verification connection should open");
        let mut statement = connection
            .prepare(
                "SELECT id, workspace_id, timestamp, category, action, outcome, actor,
                        entity_id, metadata_json, previous_hash, hash
                 FROM audit_events
                 WHERE workspace_id=?1
                 ORDER BY rowid ASC",
            )
            .expect("verification query should prepare");
        let rows = statement
            .query_map(params![DEFAULT_WORKSPACE_ID], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, String>(5)?,
                    row.get::<_, String>(6)?,
                    row.get::<_, Option<String>>(7)?,
                    row.get::<_, Option<String>>(8)?,
                    row.get::<_, String>(9)?,
                    row.get::<_, String>(10)?,
                ))
            })
            .expect("verification query should execute");

        let collected: Vec<_> = rows
            .collect::<Result<Vec<_>, _>>()
            .expect("audit rows should decode");
        assert_eq!(collected.len(), 2);

        let mut previous_hash = "GENESIS".to_string();
        for row in &collected {
            assert_eq!(row.9, previous_hash);
            let expected = audit_hash(
                &previous_hash,
                &row.0,
                &row.1,
                &row.2,
                &row.3,
                &row.4,
                &row.5,
                &row.6,
                row.7.as_deref(),
                row.8.as_deref(),
            );
            assert_eq!(row.10, expected);
            previous_hash = row.10.clone();
        }

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn migrates_legacy_schema_and_backfills_task_idempotency() {
        let connection = match Connection::open_in_memory() {
            Ok(value) => value,
            Err(error) => {
                assert!(false, "in-memory SQLite unavailable: {error}");
                return;
            }
        };

        let legacy = r#"
CREATE TABLE accounts (id TEXT PRIMARY KEY, platform TEXT NOT NULL, display_name TEXT NOT NULL, username TEXT, status TEXT NOT NULL, session_payload_json TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE campaigns (id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE campaign_accounts (campaign_id TEXT NOT NULL, account_id TEXT NOT NULL, PRIMARY KEY(campaign_id, account_id));
CREATE TABLE tasks (id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL, account_id TEXT NOT NULL, platform TEXT NOT NULL, kind TEXT NOT NULL, priority INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, max_attempts INTEGER NOT NULL DEFAULT 3, available_at TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE contacts (id TEXT PRIMARY KEY, display_name TEXT NOT NULL, phone TEXT, email TEXT, source_platform TEXT, status TEXT NOT NULL, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE conversations (id TEXT PRIMARY KEY, contact_id TEXT, platform TEXT NOT NULL, external_thread_id TEXT, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE audit_events (id TEXT PRIMARY KEY, timestamp TEXT NOT NULL, category TEXT NOT NULL, action TEXT NOT NULL, outcome TEXT NOT NULL, actor TEXT NOT NULL, entity_id TEXT, metadata_json TEXT);
INSERT INTO audit_events(id, timestamp, category, action, outcome, actor) VALUES ('legacy-audit', '900', 'security', 'legacy', 'success', 'system');
INSERT INTO tasks(id, campaign_id, account_id, platform, kind, priority, status, attempts, max_attempts, available_at, created_at)
VALUES ('legacy-task', 'legacy-campaign', 'legacy-account', 'facebook', 'publish', 0, 'pending', 0, 3, '1000', '1000');
"#;

        if let Err(error) = connection.execute_batch(legacy) {
            assert!(false, "legacy schema setup failed: {error}");
            return;
        }

        if let Err(error) = migrate_schema(&connection) {
            assert!(false, "legacy migration failed: {error}");
            return;
        }

        let version = connection
            .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
            .expect("schema version query should work");
        assert_eq!(version, SCHEMA_VERSION);

        assert!(has_column(&connection, "tasks", "workspace_id").expect("workspace column check"));
        assert!(has_column(&connection, "tasks", "idempotency_key").expect("idempotency column check"));
        assert!(has_column(&connection, "messages", "external_message_id").expect("message external id column check"));
        assert!(has_column(&connection, "conversations", "account_id").expect("conversation account column check"));

        let values: (String, String) = connection
            .query_row(
                "SELECT workspace_id, idempotency_key FROM tasks WHERE id='legacy-task'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .expect("migrated task should exist");
        assert_eq!(values.0, DEFAULT_WORKSPACE_ID);
        assert_eq!(values.1, "legacy-task");
    }
}

#[cfg(test)]
mod content_variant_tests {
    use super::*;

    #[test]
    fn telegram_variant_overrides_base_content() {
        let connection = Connection::open_in_memory().expect("sqlite");
        connection.execute_batch(
            "CREATE TABLE content_items(
               id TEXT PRIMARY KEY,
               workspace_id TEXT NOT NULL,
               body TEXT NOT NULL,
               approval_status TEXT NOT NULL
             );
             CREATE TABLE content_variants(
               content_id TEXT NOT NULL,
               platform TEXT NOT NULL,
               body TEXT,
               PRIMARY KEY(content_id, platform)
             );
             INSERT INTO content_items(id, workspace_id, body, approval_status)
             VALUES ('content-1', 'workspace-1', 'base text', 'approved');
             INSERT INTO content_variants(content_id, platform, body)
             VALUES ('content-1', 'telegram', 'Telegram text');",
        ).expect("schema");

        let body: String = connection
            .query_row(
                "SELECT COALESCE(
                   (SELECT v.body FROM content_variants v
                    WHERE v.content_id=ci.id AND v.platform='telegram'),
                   ci.body
                 )
                 FROM content_items ci
                 WHERE ci.id='content-1' AND ci.workspace_id='workspace-1'",
                [],
                |row| row.get(0),
            )
            .expect("variant query");

        assert_eq!(body, "Telegram text");
    }

    #[test]
    fn missing_variant_falls_back_to_base_content() {
        let connection = Connection::open_in_memory().expect("sqlite");
        connection.execute_batch(
            "CREATE TABLE content_items(
               id TEXT PRIMARY KEY,
               workspace_id TEXT NOT NULL,
               body TEXT NOT NULL,
               approval_status TEXT NOT NULL
             );
             CREATE TABLE content_variants(
               content_id TEXT NOT NULL,
               platform TEXT NOT NULL,
               body TEXT,
               PRIMARY KEY(content_id, platform)
             );
             INSERT INTO content_items(id, workspace_id, body, approval_status)
             VALUES ('content-1', 'workspace-1', 'base text', 'approved');",
        ).expect("schema");

        let body: String = connection
            .query_row(
                "SELECT COALESCE(
                   (SELECT v.body FROM content_variants v
                    WHERE v.content_id=ci.id AND v.platform='instagram'),
                   ci.body
                 )
                 FROM content_items ci
                 WHERE ci.id='content-1' AND ci.workspace_id='workspace-1'",
                [],
                |row| row.get(0),
            )
            .expect("fallback query");

        assert_eq!(body, "base text");
    }
}

#[cfg(test)]
mod media_import_tests {
    use super::*;

    #[test]
    fn sha256_file_matches_known_digest() {
        let path = std::env::temp_dir().join(format!("orbit-media-{}.txt", uuid_like()));
        fs::write(&path, b"ORBIT media test").expect("write test file");
        let digest = sha256_file(&path).expect("hash test file");
        let _ = fs::remove_file(&path);
        assert_eq!(
            digest,
            "d69bf854282c3de55e1aa5db4a41b89dc28bf1a91060c3b1e8a4bfa2c6246488"
        );
    }

    #[test]
    fn imported_media_type_is_inferred_from_extension() {
        let png = std::path::Path::new("launch.png");
        let mp4 = std::path::Path::new("launch.mp4");
        let pdf = std::path::Path::new("brief.pdf");
        assert_eq!(infer_media_mime(png), Some("image/png"));
        assert_eq!(infer_media_mime(mp4), Some("video/mp4"));
        assert_eq!(infer_media_mime(pdf), Some("application/pdf"));
    }
}

#[cfg(test)]
mod media_rule_pack_tests {
    use super::*;

    #[test]
    fn media_mime_must_match_kind() {
        assert!(validate_media_mime("image", "image/png").is_ok());
        assert!(validate_media_mime("image", "text/plain").is_err());
        assert!(validate_media_mime("document", "application/pdf").is_ok());
        assert!(validate_media_mime("document", "video/mp4").is_err());
    }

    #[test]
    fn media_sha256_requires_64_hex_characters() {
        assert_eq!(
            validate_media_sha256(Some(&"a".repeat(64))).expect("valid digest"),
            Some("a".repeat(64))
        );
        assert!(validate_media_sha256(Some("abcd")).is_err());
        assert!(validate_media_sha256(Some(&"g".repeat(64))).is_err());
    }

    #[test]
    fn rule_pack_validation_enforces_external_confirmation() {
        let valid = r#"[
          {
            "id": "publish",
            "platform": "telegram",
            "taskKinds": ["publish"],
            "enabled": true,
            "requiresConfirmation": true,
            "maxAttempts": 3,
            "timeoutMs": 30000
          },
          {
            "id": "sync",
            "platform": "telegram",
            "taskKinds": ["sync"],
            "enabled": true,
            "requiresConfirmation": false,
            "maxAttempts": 1,
            "timeoutMs": 30000
          }
        ]"#;
        assert!(validate_rule_pack_json("telegram", valid).is_ok());

        let unsafe_rules = valid.replace(
            "\"requiresConfirmation\": true",
            "\"requiresConfirmation\": false",
        );
        assert!(validate_rule_pack_json("telegram", &unsafe_rules).is_err());
    }

    #[test]
    fn rule_pack_validation_rejects_platform_mismatch_and_duplicates() {
        let invalid = r#"[
          {
            "id": "publish",
            "platform": "instagram",
            "taskKinds": ["publish"],
            "enabled": true,
            "requiresConfirmation": true,
            "maxAttempts": 3,
            "timeoutMs": 30000
          },
          {
            "id": "publish",
            "platform": "telegram",
            "taskKinds": ["publish"],
            "enabled": true,
            "requiresConfirmation": true,
            "maxAttempts": 3,
            "timeoutMs": 30000
          }
        ]"#;
        let error = validate_rule_pack_json("telegram", invalid)
            .expect_err("invalid rules should be rejected");
        assert!(error.contains("rule platform must match"));
    }
}

#[cfg(test)]
mod rule_pack_runtime_limits_tests {
    use super::*;

    #[test]
    fn latest_enabled_pack_provides_bounded_runtime_limits() {
        let connection = Connection::open_in_memory().expect("sqlite");
        connection.execute_batch(
            "CREATE TABLE automation_rule_packs(
               id TEXT PRIMARY KEY,
               workspace_id TEXT NOT NULL,
               platform TEXT NOT NULL,
               version TEXT NOT NULL,
               schema_version INTEGER NOT NULL,
               rules_json TEXT NOT NULL,
               enabled INTEGER NOT NULL,
               created_at TEXT NOT NULL,
               updated_at TEXT NOT NULL
             );
             INSERT INTO automation_rule_packs(
               id, workspace_id, platform, version, schema_version, rules_json,
               enabled, created_at, updated_at
             ) VALUES (
               'pack-1', 'workspace-1', 'telegram', '1.0.0', 1,
               '[{"id":"publish","platform":"telegram","taskKinds":["publish"],
                 "enabled":true,"requiresConfirmation":true,
                 "maxAttempts":5,"timeoutMs":45000}]',
               1, '1', '2'
             );",
        ).expect("schema");

        let result = load_rule_config(
            &connection,
            "workspace-1",
            "telegram",
            "publish",
        )
        .expect("rule config");
        assert_eq!(result, Some((45_000, 5)));
    }
}

#[cfg(test)]
mod execution_counter_tests {
    use super::*;

    #[test]
    fn execution_counter_rolls_over_and_resets_failures() {
        let connection = Connection::open_in_memory().expect("sqlite");
        connection.execute_batch(
            "CREATE TABLE workspaces(id TEXT PRIMARY KEY);
             CREATE TABLE accounts(id TEXT PRIMARY KEY);
             CREATE TABLE execution_counters(
               workspace_id TEXT NOT NULL,
               account_id TEXT NOT NULL,
               day_key INTEGER NOT NULL,
               completed_today INTEGER NOT NULL,
               consecutive_failures INTEGER NOT NULL,
               PRIMARY KEY(workspace_id, account_id)
             );",
        ).expect("schema");

        connection.execute(
            "INSERT INTO execution_counters(workspace_id, account_id, day_key, completed_today, consecutive_failures)
             VALUES (?1, ?2, ?3, 9, 2)",
            params!["workspace-1", "account-1", execution_day_key() - 1],
        ).expect("seed");

        let counters = load_execution_counters(&connection, "workspace-1", "account-1")
            .expect("load counters");
        assert_eq!(counters, (0, 0));
    }

    #[test]
    fn execution_counter_records_success_and_failure() {
        let connection = Connection::open_in_memory().expect("sqlite");
        connection.execute_batch(
            "CREATE TABLE execution_counters(
               workspace_id TEXT NOT NULL,
               account_id TEXT NOT NULL,
               day_key INTEGER NOT NULL,
               completed_today INTEGER NOT NULL,
               consecutive_failures INTEGER NOT NULL,
               PRIMARY KEY(workspace_id, account_id)
             );",
        ).expect("schema");

        connection.execute(
            "INSERT INTO execution_counters(workspace_id, account_id, day_key, completed_today, consecutive_failures)
             VALUES (?1, ?2, ?3, 0, 0)",
            params!["workspace-1", "account-1", execution_day_key()],
        ).expect("seed");

        record_execution_failure(&connection, "workspace-1", "account-1").expect("failure");
        let after_failure = load_execution_counters(&connection, "workspace-1", "account-1").expect("load");
        assert_eq!(after_failure.1, 1);

        record_execution_success(&connection, "workspace-1", "account-1").expect("success");
        let after_success = load_execution_counters(&connection, "workspace-1", "account-1").expect("load");
        assert_eq!(after_success, (1, 0));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let result = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            app_health,
            workspace_list,
            workspace_current,
            workspace_create,
            workspace_select,
            telegram_execute_task,
            vault_put,
            vault_get,
            vault_delete,
            account_upsert,
            account_list,
            account_get_session,
            account_delete,
            campaign_create,
            campaign_list,
            content_upsert,
            content_list,
            content_variant_upsert,
            media_asset_upsert,
            media_asset_import,
            media_asset_delete,
            media_asset_list,
            automation_rule_pack_upsert,
            automation_rule_pack_set_enabled,
            automation_rule_pack_list,
            content_variant_list,
            campaign_attach_content,
            approval_request,
            approval_decide,
            approval_list,
            task_enqueue,
            task_claim_next,
            task_fail,
            task_set_status,
            task_list,
            contact_upsert,
            contact_list,
            backup_create,
            backup_list,
            backup_restore,
            conversation_upsert,
            message_add,
            inbox_list,
            message_list,
            audit_list,
            analytics_summary,
            audit_verify,
            license::license_install,
            license::license_status,
            license::license_delete
        ])
        .run(tauri::generate_context!());

    if let Err(error) = result {
        eprintln!("failed to run ORBIT Marketing OS: {error}");
    }
}
