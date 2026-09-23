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

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS vault_records (
  label TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
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
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS campaign_accounts (
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  PRIMARY KEY (campaign_id, account_id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  platform TEXT NOT NULL,
  kind TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  available_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
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

CREATE INDEX IF NOT EXISTS idx_contacts_updated
  ON contacts(updated_at);
"#;

#[derive(Debug, Error)]
enum AppError {
    #[error("database error")]
    Database(#[from] rusqlite::Error),
    #[error("serialization error")]
    Serialization(#[from] serde_json::Error),
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
struct AccountView {
    id: String,
    platform: String,
    display_name: String,
    username: Option<String>,
    status: String,
    has_encrypted_session: bool,
}

fn open_db(app: &tauri::AppHandle) -> Result<Connection, AppError> {
    let app_data = app.path().app_data_dir().map_err(|_| AppError::Path)?;
    fs::create_dir_all(&app_data)?;
    let db_path: PathBuf = app_data.join("orbit.sqlite3");
    let connection = Connection::open(db_path)?;
    connection.execute_batch(SCHEMA)?;
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
    connection
        .execute(
            "INSERT INTO accounts(id, platform, display_name, username, status, session_payload_json, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, 'connected', ?5, ?6, ?6)
             ON CONFLICT(id) DO UPDATE SET
               platform=excluded.platform,
               display_name=excluded.display_name,
               username=excluded.username,
               session_payload_json=COALESCE(excluded.session_payload_json, accounts.session_payload_json),
               updated_at=excluded.updated_at",
            params![id, platform, display_name, username, session_payload_json, timestamp],
        )
        .map_err(|error| error.to_string())?;

    Ok(AccountView {
        id,
        platform,
        display_name,
        username,
        status: "connected".to_string(),
        has_encrypted_session: session_payload_json.is_some(),
    })
}

#[tauri::command]
fn account_list(app: tauri::AppHandle) -> Result<Vec<AccountView>, String> {
    let connection = open_db(&app).map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare("SELECT id, platform, display_name, username, status, session_payload_json FROM accounts ORDER BY created_at DESC")
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map([], |row| {
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
            "SELECT session_payload_json FROM accounts WHERE id = ?1",
            params![id],
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
        .execute("DELETE FROM accounts WHERE id = ?1", params![id])
        .map_err(|error| error.to_string())?;
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
            "INSERT INTO campaigns(id, name, status, created_at) VALUES (?1, ?2, 'draft', ?3)",
            params![campaign_id, name, timestamp],
        )
        .map_err(|error| error.to_string())?;

    for account_id in &account_ids {
        transaction
            .execute(
                "INSERT INTO campaign_accounts(campaign_id, account_id) VALUES (?1, ?2)",
                params![campaign_id, validate_label(account_id).map_err(|error| error.to_string())?],
            )
            .map_err(|error| error.to_string())?;
    }

    transaction.commit().map_err(|error| error.to_string())?;

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
             LEFT JOIN tasks t ON t.campaign_id = c.id
             GROUP BY c.id
             ORDER BY c.created_at DESC",
        )
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map([], |row| {
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
) -> Result<TaskView, String> {
    let id = validate_label(&id).map_err(|error| error.to_string())?;
    let campaign_id = validate_label(&campaign_id).map_err(|error| error.to_string())?;
    let account_id = validate_label(&account_id).map_err(|error| error.to_string())?;
    let platform = validate_platform(&platform).map_err(|error| error.to_string())?;
    let kind = validate_label(&kind).map_err(|error| error.to_string())?;
    if priority < 0 || max_attempts < 1 || available_at.trim().is_empty() {
        return Err("invalid task parameters".to_string());
    }

    let connection = open_db(&app).map_err(|error| error.to_string())?;
    let created_at = chrono_like_timestamp();
    connection
        .execute(
            "INSERT INTO tasks(id, campaign_id, account_id, platform, kind, priority, status, attempts, max_attempts, available_at, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'pending', 0, ?7, ?8, ?9)",
            params![id, campaign_id, account_id, platform, kind, priority, max_attempts, available_at, created_at],
        )
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
            "SELECT id, campaign_id, account_id, platform, kind, priority, attempts, max_attempts, available_at, created_at
             FROM tasks
             WHERE status='pending' AND available_at <= ?1
             ORDER BY priority DESC, available_at ASC, created_at ASC
             LIMIT 1",
            params![now],
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
                    available_at: row.get(8)?,
                    created_at: row.get(9)?,
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

    transaction
        .execute("UPDATE tasks SET status='running' WHERE id=?1 AND status='pending'", params![task.id])
        .map_err(|error| error.to_string())?;
    transaction.commit().map_err(|error| error.to_string())?;
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
    let changed = connection
        .execute("UPDATE tasks SET status=?1 WHERE id=?2", params![status, validate_label(&id).map_err(|error| error.to_string())?])
        .map_err(|error| error.to_string())?;
    Ok(changed > 0)
}

#[tauri::command]
fn task_list(app: tauri::AppHandle, campaign_id: Option<String>) -> Result<Vec<TaskView>, String> {
    let connection = open_db(&app).map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare(
            "SELECT id, campaign_id, account_id, platform, kind, priority, status, attempts, max_attempts, available_at, created_at
             FROM tasks
             WHERE (?1 IS NULL OR campaign_id = ?1)
             ORDER BY priority DESC, available_at ASC",
        )
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map(params![campaign_id], |row| {
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
                available_at: row.get(9)?,
                created_at: row.get(10)?,
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
            "INSERT INTO contacts(id, display_name, phone, email, source_platform, status, notes, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)
             ON CONFLICT(id) DO UPDATE SET
               display_name=excluded.display_name,
               phone=excluded.phone,
               email=excluded.email,
               source_platform=excluded.source_platform,
               status=excluded.status,
               notes=excluded.notes,
               updated_at=excluded.updated_at",
            params![id, display_name, phone, email, source_platform, status, notes, timestamp],
        )
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
             WHERE (?1 IS NULL OR display_name LIKE ?1 OR phone LIKE ?1 OR email LIKE ?1)
             ORDER BY updated_at DESC",
        )
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map(params![pattern], |row| {
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

fn chrono_like_timestamp() -> String {
    match std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH) {
        Ok(duration) => duration.as_secs().to_string(),
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
            backup_restore
        ])
        .run(tauri::generate_context!());

    if let Err(error) = result {
        eprintln!("failed to run ORBIT Marketing OS: {error}");
    }
}
