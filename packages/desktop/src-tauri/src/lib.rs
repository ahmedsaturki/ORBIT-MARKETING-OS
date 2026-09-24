use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Key, Nonce,
};
use argon2::Argon2;
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use rand::RngCore;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::Manager;
use thiserror::Error;
use zeroize::Zeroizing;

const DEFAULT_WORKSPACE_ID: &str = "default";
const SCHEMA_VERSION: i64 = 2;

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS vault_records (
  label TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
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

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  external_thread_id TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(workspace_id, platform, external_thread_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  timestamp TEXT NOT NULL,
  category TEXT NOT NULL,
  action TEXT NOT NULL,
  outcome TEXT NOT NULL,
  actor TEXT NOT NULL,
  entity_id TEXT,
  metadata_json TEXT
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
struct TaskView {
    id: String,
    campaign_id: String,
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
struct AuditView {
    id: String,
    timestamp: String,
    category: String,
    action: String,
    outcome: String,
    actor: String,
    entity_id: Option<String>,
    metadata_json: Option<String>,
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

fn has_column(connection: &Connection, table: &str, column: &str) -> Result<bool, rusqlite::Error> {
    let mut statement = connection.prepare(&format!("PRAGMA table_info({table})"))?;
    let rows = statement.query_map([], |row| row.get::<_, String>(1))?;
    for row in rows {
        if row? == column {
            return Ok(true);
        }
    }
    Ok(false)
}

fn migrate_schema(connection: &Connection) -> Result<(), AppError> {
    let version: i64 = connection.query_row("PRAGMA user_version", [], |row| row.get(0))?;

    if version < SCHEMA_VERSION {
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

    Ok(())
}

fn open_db(app: &tauri::AppHandle) -> Result<Connection, AppError> {
    let app_data = app.path().app_data_dir().map_err(|_| AppError::Path)?;
    fs::create_dir_all(&app_data)?;
    let db_path: PathBuf = app_data.join("orbit.sqlite3");
    let connection = Connection::open(db_path)?;
    connection.execute_batch(SCHEMA)?;
    migrate_schema(&connection)?;
    Ok(connection)
}

fn derive_key(password: &str, salt: &[u8]) -> Result<Zeroizing<[u8; 32]>, AppError> {
    if password.is_empty() || salt.len() < 16 {
        return Err(AppError::InvalidPassword);
    }

    let mut output = Zeroizing::new([0u8; 32]);
    Argon2::default()
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

fn validate_label(label: &str) -> Result<String, AppError> {
    let value = label.trim();
    if value.is_empty() || value.len() > 200 {
        return Err(AppError::InvalidLabel);
    }
    Ok(value.to_string())
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
    let label = validate_label(&label).map_err(|error| error.to_string())?;
    if plaintext.is_empty() || password.is_empty() {
        return Err(AppError::InvalidPassword.to_string());
    }

    let payload = seal(&password, &plaintext).map_err(|error| error.to_string())?;
    let payload_json = serde_json::to_string(&payload).map_err(|error| error.to_string())?;
    let connection = open_db(&app).map_err(|error| error.to_string())?;
    let timestamp = chrono_like_timestamp();
    connection
        .execute(
            "INSERT INTO vault_records(label, payload_json, updated_at)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(label) DO UPDATE SET payload_json=excluded.payload_json, updated_at=excluded.updated_at",
            params![label, payload_json, timestamp],
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
    let label = validate_label(&label).map_err(|error| error.to_string())?;
    let connection = open_db(&app).map_err(|error| error.to_string())?;
    let payload_json: String = connection
        .query_row(
            "SELECT payload_json FROM vault_records WHERE label = ?1",
            params![label],
            |row| row.get(0),
        )
        .map_err(|error| match error {
            rusqlite::Error::QueryReturnedNoRows => AppError::NotFound.to_string(),
            other => AppError::Database(other).to_string(),
        })?;

    let payload: EncryptedPayload =
        serde_json::from_str(&payload_json).map_err(|error| error.to_string())?;
    open_payload(&password, &payload).map_err(|error| error.to_string())
}

#[tauri::command]
fn vault_delete(app: tauri::AppHandle, label: String) -> Result<bool, String> {
    let label = validate_label(&label).map_err(|error| error.to_string())?;
    let connection = open_db(&app).map_err(|error| error.to_string())?;
    let changed = connection
        .execute("DELETE FROM vault_records WHERE label = ?1", params![label])
        .map_err(|error| error.to_string())?;
    Ok(changed > 0)
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
    let timestamp = chrono_like_timestamp();
    let status = if session_payload_json.is_some() { "connected" } else { "needs_refresh" };
    connection
        .execute(
            "INSERT INTO accounts(id, workspace_id, platform, display_name, username, status, session_payload_json, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)
             ON CONFLICT(id) DO UPDATE SET
               platform=excluded.platform,
               display_name=excluded.display_name,
               username=excluded.username,
               session_payload_json=COALESCE(excluded.session_payload_json, accounts.session_payload_json),
               updated_at=excluded.updated_at",
            params![id, DEFAULT_WORKSPACE_ID, platform, display_name, username, status, session_payload_json, timestamp],
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
        has_encrypted_session: session_payload_json.is_some(),
    })
}

#[tauri::command]
fn account_list(app: tauri::AppHandle) -> Result<Vec<AccountView>, String> {
    let connection = open_db(&app).map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare("SELECT id, platform, display_name, username, status, session_payload_json FROM accounts WHERE workspace_id=?1 ORDER BY created_at DESC")
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map(params![DEFAULT_WORKSPACE_ID], |row| {
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
    let id = validate_label(&id).map_err(|error| error.to_string())?;
    if password.is_empty() {
        return Err(AppError::InvalidPassword.to_string());
    }

    let connection = open_db(&app).map_err(|error| error.to_string())?;
    let payload_json: Option<String> = connection
        .query_row(
            "SELECT session_payload_json FROM accounts WHERE id = ?1 AND workspace_id = ?2",
            params![id, DEFAULT_WORKSPACE_ID],
            |row| row.get(0),
        )
        .map_err(|error| match error {
            rusqlite::Error::QueryReturnedNoRows => AppError::NotFound.to_string(),
            other => AppError::Database(other).to_string(),
        })?;

    let payload_json = payload_json.ok_or_else(|| AppError::NotFound.to_string())?;
    let payload: EncryptedPayload =
        serde_json::from_str(&payload_json).map_err(|error| error.to_string())?;
    open_payload(&password, &payload).map_err(|error| error.to_string())
}

#[tauri::command]
fn account_delete(app: tauri::AppHandle, id: String) -> Result<bool, String> {
    let id = validate_label(&id).map_err(|error| error.to_string())?;
    let connection = open_db(&app).map_err(|error| error.to_string())?;
    let changed = connection
        .execute("DELETE FROM accounts WHERE id = ?1 AND workspace_id = ?2", params![id, DEFAULT_WORKSPACE_ID])
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
    let name = validate_label(&name).map_err(|error| error.to_string())?;
    if account_ids.is_empty() {
        return Err("at least one account is required".to_string());
    }

    let connection = open_db(&app).map_err(|error| error.to_string())?;
    let campaign_id = format!("camp-{}", uuid_like());
    let timestamp = chrono_like_timestamp();
    let transaction = connection
        .unchecked_transaction()
        .map_err(|error| error.to_string())?;

    transaction
        .execute(
            "INSERT INTO campaigns(id, workspace_id, name, status, created_at) VALUES (?1, ?2, ?3, 'draft', ?4)",
            params![campaign_id, DEFAULT_WORKSPACE_ID, name, timestamp],
        )
        .map_err(|error| error.to_string())?;

    for account_id in &account_ids {
        transaction
            .execute(
                "INSERT INTO campaign_accounts(workspace_id, campaign_id, account_id) VALUES (?1, ?2, ?3)",
                params![DEFAULT_WORKSPACE_ID, campaign_id, validate_label(account_id).map_err(|error| error.to_string())?],
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
    let connection = open_db(&app).map_err(|error| error.to_string())?;
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
        .query_map(params![DEFAULT_WORKSPACE_ID], |row| {
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
) -> Result<TaskView, String> {
    let id = validate_label(&id).map_err(|error| error.to_string())?;
    let campaign_id = validate_label(&campaign_id).map_err(|error| error.to_string())?;
    let account_id = validate_label(&account_id).map_err(|error| error.to_string())?;
    let platform = validate_platform(&platform).map_err(|error| error.to_string())?;
    let kind = validate_label(&kind).map_err(|error| error.to_string())?;
    let idempotency_key = idempotency_key
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| id.clone());
    let idempotency_key = validate_label(&idempotency_key).map_err(|error| error.to_string())?;

    if priority < 0 || max_attempts < 1 || available_at.trim().is_empty() {
        return Err("invalid task parameters".to_string());
    }

    let connection = open_db(&app).map_err(|error| error.to_string())?;
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
             )",
            params![campaign_id, account_id, DEFAULT_WORKSPACE_ID],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    if !associated {
        return Err("account is not part of campaign".to_string());
    }

    let created_at = chrono_like_timestamp();
    connection
        .execute(
            "INSERT INTO tasks(
               id, workspace_id, campaign_id, account_id, platform, kind,
               priority, status, attempts, max_attempts, available_at,
               idempotency_key, created_at
             )
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending', 0, ?8, ?9, ?10, ?11)",
            params![
                id,
                DEFAULT_WORKSPACE_ID,
                campaign_id,
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
    let mut connection = open_db(&app).map_err(|error| error.to_string())?;
    let transaction = connection
        .transaction()
        .map_err(|error| error.to_string())?;

    let candidate = transaction
        .query_row(
            "SELECT id, campaign_id, account_id, platform, kind, priority,
                    attempts, max_attempts, idempotency_key, available_at, created_at
             FROM tasks
             WHERE workspace_id=?2
               AND status='pending'
               AND available_at <= ?1
             ORDER BY priority DESC, available_at ASC, created_at ASC
             LIMIT 1",
            params![now, DEFAULT_WORKSPACE_ID],
            |row| {
                Ok(TaskView {
                    id: row.get(0)?,
                    campaign_id: row.get(1)?,
                    account_id: row.get(2)?,
                    platform: row.get(3)?,
                    kind: row.get(4)?,
                    priority: row.get(5)?,
                    status: "running".to_string(),
                    attempts: row.get(6)?,
                    max_attempts: row.get(7)?,
                    idempotency_key: row.get(8)?,
                    available_at: row.get(9)?,
                    created_at: row.get(10)?,
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
            params![task.id, DEFAULT_WORKSPACE_ID],
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
    let allowed = ["pending", "running", "succeeded", "failed", "blocked", "cancelled"];
    if !allowed.contains(&status.as_str()) {
        return Err("unsupported task status".to_string());
    }

    let connection = open_db(&app).map_err(|error| error.to_string())?;
    let entity_id = validate_label(&id).map_err(|error| error.to_string())?;
    let changed = connection
        .execute(
            "UPDATE tasks SET status=?1 WHERE id=?2 AND workspace_id=?3",
            params![status, &entity_id, DEFAULT_WORKSPACE_ID],
        )
        .map_err(|error| error.to_string())?;
    if changed > 0 {
        write_audit(&connection, "task", "status", "success", "user", Some(&entity_id))
            .map_err(|error| error.to_string())?;
    }
    Ok(changed > 0)
}

#[tauri::command]
fn task_list(app: tauri::AppHandle, campaign_id: Option<String>) -> Result<Vec<TaskView>, String> {
    let connection = open_db(&app).map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare(
            "SELECT id, campaign_id, account_id, platform, kind, priority,
                    status, attempts, max_attempts, idempotency_key, available_at, created_at
             FROM tasks
             WHERE workspace_id=?1
               AND (?2 IS NULL OR campaign_id=?2)
             ORDER BY priority DESC, available_at ASC",
        )
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map(params![DEFAULT_WORKSPACE_ID, campaign_id], |row| {
            Ok(TaskView {
                id: row.get(0)?,
                campaign_id: row.get(1)?,
                account_id: row.get(2)?,
                platform: row.get(3)?,
                kind: row.get(4)?,
                priority: row.get(5)?,
                status: row.get(6)?,
                attempts: row.get(7)?,
                max_attempts: row.get(8)?,
                idempotency_key: row.get(9)?,
                available_at: row.get(10)?,
                created_at: row.get(11)?,
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
    let id = validate_label(&id).map_err(|error| error.to_string())?;
    let display_name = validate_label(&display_name).map_err(|error| error.to_string())?;
    let allowed_status = ["new", "interested", "sold", "lost"];
    if !allowed_status.contains(&status.as_str()) {
        return Err("unsupported contact status".to_string());
    }
    let timestamp = chrono_like_timestamp();

    let connection = open_db(&app).map_err(|error| error.to_string())?;
    connection
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
               updated_at=excluded.updated_at",
            params![
                id,
                DEFAULT_WORKSPACE_ID,
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
    let connection = open_db(&app).map_err(|error| error.to_string())?;
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
        .query_map(params![DEFAULT_WORKSPACE_ID, pattern], |row| {
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

    let _connection = open_db(&app).map_err(|error| error.to_string())?;
    drop(_connection);
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

    let bytes = fs::read(&temp_path).map_err(|error| error.to_string())?;
    fs::remove_file(&temp_path).map_err(|error| error.to_string())?;

    let payload = seal(&password, &B64.encode(bytes)).map_err(|error| error.to_string())?;
    let payload_json = serde_json::to_string(&payload).map_err(|error| error.to_string())?;
    let filename = format!("orbit-{}.orbitbackup", chrono_like_timestamp());
    let destination = backups.join(&filename);
    fs::write(&destination, payload_json).map_err(|error| error.to_string())?;
    write_audit(&open_db(&app).map_err(|error| error.to_string())?, "backup", "create", "success", "user", Some(&filename))
        .map_err(|error| error.to_string())?;

    Ok(filename)
}

#[tauri::command]
fn backup_list(app: tauri::AppHandle) -> Result<Vec<String>, String> {
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

    let integrity = Connection::open(&temporary)
        .and_then(|connection| {
            connection.query_row("PRAGMA integrity_check", [], |row| row.get::<_, String>(0))
        })
        .map_err(|error| error.to_string())?;
    if integrity != "ok" {
        let _ = fs::remove_file(&temporary);
        return Err("backup integrity check failed".to_string());
    }

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

    Ok(true)
}

fn write_audit(
    connection: &Connection,
    category: &str,
    action: &str,
    outcome: &str,
    actor: &str,
    entity_id: Option<&str>,
) -> Result<(), rusqlite::Error> {
    connection.execute(
        "INSERT INTO audit_events(
           id, workspace_id, timestamp, category, action, outcome, actor, entity_id
         )
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            uuid_like(),
            DEFAULT_WORKSPACE_ID,
            chrono_like_timestamp(),
            category,
            action,
            outcome,
            actor,
            entity_id
        ],
    )?;
    Ok(())
}

#[tauri::command]
fn conversation_upsert(
    app: tauri::AppHandle,
    id: String,
    contact_id: Option<String>,
    platform: String,
    external_thread_id: Option<String>,
    status: String,
) -> Result<ConversationView, String> {
    let id = validate_label(&id).map_err(|error| error.to_string())?;
    let platform = validate_platform(&platform).map_err(|error| error.to_string())?;
    let allowed_status = ["new", "interested", "potential_customer", "complaint", "closed"];
    if !allowed_status.contains(&status.as_str()) {
        return Err("unsupported conversation status".to_string());
    }

    let connection = open_db(&app).map_err(|error| error.to_string())?;
    let timestamp = chrono_like_timestamp();
    connection
        .execute(
            "INSERT INTO conversations(
               id, workspace_id, contact_id, platform, external_thread_id,
               status, created_at, updated_at
             )
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)
             ON CONFLICT(id) DO UPDATE SET
               contact_id=excluded.contact_id,
               platform=excluded.platform,
               external_thread_id=excluded.external_thread_id,
               status=excluded.status,
               updated_at=excluded.updated_at",
            params![
                id,
                DEFAULT_WORKSPACE_ID,
                contact_id,
                platform,
                external_thread_id,
                status,
                timestamp
            ],
        )
        .map_err(|error| error.to_string())?;

    write_audit(&connection, "conversation", "upsert", "success", "user", Some(&id))
        .map_err(|error| error.to_string())?;

    Ok(ConversationView {
        id,
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
    let conversation_exists: bool = connection
        .query_row(
            "SELECT EXISTS(
               SELECT 1 FROM conversations WHERE id=?1 AND workspace_id=?2
             )",
            params![conversation_id, DEFAULT_WORKSPACE_ID],
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
            params![sent_at, conversation_id, DEFAULT_WORKSPACE_ID],
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
    let connection = open_db(&app).map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare(
            "SELECT c.id, c.contact_id, c.platform, c.external_thread_id, c.status, COUNT(m.id), c.updated_at
             FROM conversations c
             LEFT JOIN messages m ON m.conversation_id=c.id
             WHERE c.workspace_id=?1
             GROUP BY c.id
             ORDER BY c.updated_at DESC",
        )
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map(params![DEFAULT_WORKSPACE_ID], |row| {
            Ok(ConversationView {
                id: row.get(0)?,
                contact_id: row.get(1)?,
                platform: row.get(2)?,
                external_thread_id: row.get(3)?,
                status: row.get(4)?,
                message_count: row.get(5)?,
                updated_at: row.get(6)?,
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
    let conversation_id = validate_label(&conversation_id).map_err(|error| error.to_string())?;
    let connection = open_db(&app).map_err(|error| error.to_string())?;
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
        .query_map(params![conversation_id, DEFAULT_WORKSPACE_ID], |row| {
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
fn audit_list(app: tauri::AppHandle, limit: Option<i64>) -> Result<Vec<AuditView>, String> {
    let limit = limit.unwrap_or(100).clamp(1, 500);
    let connection = open_db(&app).map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare(
            "SELECT id, timestamp, category, action, outcome, actor, entity_id, metadata_json
             FROM audit_events
             WHERE workspace_id=?1
             ORDER BY timestamp DESC LIMIT ?2",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params![DEFAULT_WORKSPACE_ID, limit], |row| {
            Ok(AuditView {
                id: row.get(0)?,
                timestamp: row.get(1)?,
                category: row.get(2)?,
                action: row.get(3)?,
                outcome: row.get(4)?,
                actor: row.get(5)?,
                entity_id: row.get(6)?,
                metadata_json: row.get(7)?,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

fn chrono_like_timestamp() -> String {
    match std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH) {
        Ok(duration) => duration.as_millis().to_string(),
        Err(_) => "0".to_string(),
    }
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
    fn validates_labels() {
        assert!(validate_label("vault-entry").is_ok());
        assert!(validate_label("   ").is_err());
        assert!(validate_label(&"x".repeat(201)).is_err());
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let result = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            app_health,
            vault_put,
            vault_get,
            vault_delete,
            account_upsert,
            account_list,
            account_get_session,
            account_delete,
            campaign_create,
            campaign_list,
            task_enqueue,
            task_claim_next,
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
            audit_list
        ])
        .run(tauri::generate_context!());

    if let Err(error) = result {
        eprintln!("failed to run ORBIT Marketing OS: {error}");
    }
}
