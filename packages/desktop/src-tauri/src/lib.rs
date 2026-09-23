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
        let payload = seal("correct-password", "local-secret").expect("test encryption should succeed");
        let recovered = open_payload("correct-password", &payload).expect("test decryption should succeed");
        assert_eq!(recovered, "local-secret");
    }

    #[test]
    fn rejects_wrong_password() {
        let payload = seal("correct-password", "local-secret").expect("test encryption should succeed");
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
        .invoke_handler(tauri::generate_handler![app_health, vault_put, vault_get, vault_delete])
        .run(tauri::generate_context!());

    if let Err(error) = result {
        eprintln!("failed to run ORBIT Marketing OS: {error}");
    }
}
