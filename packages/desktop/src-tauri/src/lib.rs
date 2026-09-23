use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Key, Nonce,
};
use argon2::Argon2;
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use rand::RngCore;
use rusqlite::{params, Connection};
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
            account_delete
        ])
        .run(tauri::generate_context!());

    if let Err(error) = result {
        eprintln!("failed to run ORBIT Marketing OS: {error}");
    }
}
