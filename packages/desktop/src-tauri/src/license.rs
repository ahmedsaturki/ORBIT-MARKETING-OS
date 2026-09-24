use base64::{
    engine::general_purpose::{STANDARD as B64, URL_SAFE_NO_PAD},
    Engine as _,
};
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};

const LICENSE_PUBLIC_KEY_B64: &str =
    "TM9dnIPSgNRBrd9JnGiVsCgPYA3/ttjdPpn1y64AjUA=";

#[derive(Debug, Clone, Serialize, Deserialize)]
struct LicensePayload {
    #[serde(rename = "licenseId")]
    license_id: String,
    plan: String,
    subject: String,
    #[serde(rename = "issuedAt")]
    issued_at: String,
    #[serde(rename = "expiresAt")]
    expires_at: Option<String>,
    #[serde(rename = "maxDevices")]
    max_devices: u64,
    #[serde(rename = "accountLimit")]
    account_limit: u64,
    features: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
struct CanonicalLicenseMessage {
    #[serde(rename = "licenseId")]
    license_id: String,
    plan: String,
    subject: String,
    #[serde(rename = "issuedAt")]
    issued_at: String,
    #[serde(rename = "expiresAt")]
    expires_at: Option<String>,
    #[serde(rename = "maxDevices")]
    max_devices: u64,
    #[serde(rename = "accountLimit")]
    account_limit: u64,
    features: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct LicenseStatus {
    pub installed: bool,
    pub valid: bool,
    pub reason: String,
    pub license_id: Option<String>,
    pub plan: Option<String>,
    pub subject: Option<String>,
    pub expires_at: Option<String>,
    pub max_devices: Option<u64>,
    pub account_limit: Option<u64>,
    pub feature_count: usize,
    pub account_count: u64,
}

fn open_connection(app: &tauri::AppHandle) -> Result<Connection, String> {
    crate::open_db_for_module(app)
}

fn ensure_license_table(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "CREATE TABLE IF NOT EXISTS license_records (
               id INTEGER PRIMARY KEY CHECK(id=1),
               token TEXT NOT NULL,
               updated_at TEXT NOT NULL
             );",
        )
        .map_err(|error| error.to_string())
}

fn canonical_message(payload: &LicensePayload) -> CanonicalLicenseMessage {
    CanonicalLicenseMessage {
        license_id: payload.license_id.clone(),
        plan: payload.plan.clone(),
        subject: payload.subject.clone(),
        issued_at: payload.issued_at.clone(),
        expires_at: payload.expires_at.clone(),
        max_devices: payload.max_devices,
        account_limit: payload.account_limit,
        features: payload.features.clone(),
    }
}

fn validate_payload(payload: &LicensePayload) -> Result<(), String> {
    if payload.license_id.trim().is_empty() || payload.license_id.len() > 200 {
        return Err("invalid license id".to_string());
    }
    if payload.subject.trim().is_empty() || payload.subject.len() > 200 {
        return Err("invalid license subject".to_string());
    }
    if !["basic", "pro", "agency", "lifetime"].contains(&payload.plan.as_str()) {
        return Err("invalid license plan".to_string());
    }
    if payload.max_devices < 1 || payload.account_limit < 1 {
        return Err("invalid license limits".to_string());
    }
    if payload.features.len() > 100
        || payload
            .features
            .iter()
            .any(|feature| feature.trim().is_empty() || feature.len() > 100)
    {
        return Err("invalid license features".to_string());
    }

    let issued_at = OffsetDateTime::parse(&payload.issued_at, &Rfc3339)
        .map_err(|_| "invalid license issuedAt".to_string())?;
    if let Some(expires_at) = &payload.expires_at {
        let expiry = OffsetDateTime::parse(expires_at, &Rfc3339)
            .map_err(|_| "invalid license expiresAt".to_string())?;
        if expiry < issued_at {
            return Err("license expiry precedes issue time".to_string());
        }
    }

    Ok(())
}

fn decode_token(token: &str) -> Result<LicensePayload, String> {
    let mut parts = token.split('.');
    let payload_part = parts.next().ok_or_else(|| "invalid license token".to_string())?;
    let signature_part = parts.next().ok_or_else(|| "invalid license token".to_string())?;
    if parts.next().is_some() || payload_part.is_empty() || signature_part.is_empty() {
        return Err("invalid license token".to_string());
    }

    let payload_bytes = URL_SAFE_NO_PAD
        .decode(payload_part)
        .map_err(|_| "invalid license payload encoding".to_string())?;
    let signature_bytes = URL_SAFE_NO_PAD
        .decode(signature_part)
        .map_err(|_| "invalid license signature encoding".to_string())?;
    let payload: LicensePayload = serde_json::from_slice(&payload_bytes)
        .map_err(|_| "invalid license payload".to_string())?;
    validate_payload(&payload)?;

    let public_bytes = B64
        .decode(LICENSE_PUBLIC_KEY_B64)
        .map_err(|_| "invalid embedded license public key".to_string())?;
    let public_array: [u8; 32] = public_bytes
        .try_into()
        .map_err(|_| "invalid embedded license public key length".to_string())?;
    let verifying_key =
        VerifyingKey::from_bytes(&public_array).map_err(|_| "invalid license public key".to_string())?;
    let signature =
        Signature::from_slice(&signature_bytes).map_err(|_| "invalid license signature".to_string())?;

    let canonical = serde_json::to_vec(&canonical_message(&payload))
        .map_err(|_| "failed to serialize license".to_string())?;
    verifying_key
        .verify(&canonical, &signature)
        .map_err(|_| "license signature verification failed".to_string())?;

    Ok(payload)
}

fn evaluate_payload(
    payload: &LicensePayload,
    account_count: u64,
) -> Result<(), String> {
    let now = OffsetDateTime::now_utc();
    let issued_at = OffsetDateTime::parse(&payload.issued_at, &Rfc3339)
        .map_err(|_| "invalid license issuedAt".to_string())?;
    if issued_at > now {
        return Err("license issuedAt is in the future".to_string());
    }

    if let Some(expires_at) = &payload.expires_at {
        let expiry = OffsetDateTime::parse(expires_at, &Rfc3339)
            .map_err(|_| "invalid license expiresAt".to_string())?;
        if expiry < now {
            return Err("license expired".to_string());
        }
    }

    if payload.max_devices < 1 {
        return Err("device limit exceeded".to_string());
    }

    if account_count > payload.account_limit {
        return Err("account limit exceeded".to_string());
    }

    Ok(())
}

fn load_token(connection: &Connection) -> Result<Option<String>, String> {
    connection
        .query_row(
            "SELECT token FROM license_records WHERE id=1",
            [],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| error.to_string())
}

fn account_count(connection: &Connection) -> Result<u64, String> {
    connection
        .query_row(
            "SELECT COUNT(*) FROM accounts",
            [],
            |row| row.get::<_, i64>(0),
        )
        .map(|value| value.max(0) as u64)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn license_install(
    app: tauri::AppHandle,
    token: String,
) -> Result<LicenseStatus, String> {
    let token = token.trim().to_string();
    if token.is_empty() || token.len() > 20_000 {
        return Err("invalid license token".to_string());
    }

    let payload = decode_token(&token)?;
    let connection = open_connection(&app)?;
    crate::require_workspace_role_for_module(&connection, &["owner", "admin"])?;
    ensure_license_table(&connection)?;
    let accounts = account_count(&connection)?;
    evaluate_payload(&payload, accounts)?;

    let timestamp = OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .map_err(|_| "failed to format timestamp".to_string())?;

    connection
        .execute(
            "INSERT INTO license_records(id, token, updated_at)
             VALUES (1, ?1, ?2)
             ON CONFLICT(id) DO UPDATE SET token=excluded.token, updated_at=excluded.updated_at",
            params![token, timestamp],
        )
        .map_err(|error| error.to_string())?;

    Ok(LicenseStatus {
        installed: true,
        valid: true,
        reason: "valid".to_string(),
        license_id: Some(payload.license_id),
        plan: Some(payload.plan),
        subject: Some(payload.subject),
        expires_at: payload.expires_at,
        max_devices: Some(payload.max_devices),
        account_limit: Some(payload.account_limit),
        feature_count: payload.features.len(),
        account_count: accounts,
    })
}

#[tauri::command]
pub fn license_status(app: tauri::AppHandle) -> Result<LicenseStatus, String> {
    let connection = open_connection(&app)?;
    ensure_license_table(&connection)?;
    let accounts = account_count(&connection)?;
    let token = load_token(&connection)?;

    let Some(token) = token else {
        return Ok(LicenseStatus {
            installed: false,
            valid: false,
            reason: "not_installed".to_string(),
            license_id: None,
            plan: None,
            subject: None,
            expires_at: None,
            max_devices: None,
            account_limit: None,
            feature_count: 0,
            account_count: accounts,
        });
    };

    match decode_token(&token) {
        Ok(payload) => match evaluate_payload(&payload, accounts) {
            Ok(()) => Ok(LicenseStatus {
                installed: true,
                valid: true,
                reason: "valid".to_string(),
                license_id: Some(payload.license_id),
                plan: Some(payload.plan),
                subject: Some(payload.subject),
                expires_at: payload.expires_at,
                max_devices: Some(payload.max_devices),
                account_limit: Some(payload.account_limit),
                feature_count: payload.features.len(),
                account_count: accounts,
            }),
            Err(reason) => Ok(LicenseStatus {
                installed: true,
                valid: false,
                reason,
                license_id: Some(payload.license_id),
                plan: Some(payload.plan),
                subject: Some(payload.subject),
                expires_at: payload.expires_at,
                max_devices: Some(payload.max_devices),
                account_limit: Some(payload.account_limit),
                feature_count: payload.features.len(),
                account_count: accounts,
            }),
        },
        Err(reason) => Ok(LicenseStatus {
            installed: true,
            valid: false,
            reason,
            license_id: None,
            plan: None,
            subject: None,
            expires_at: None,
            max_devices: None,
            account_limit: None,
            feature_count: 0,
            account_count: accounts,
        }),
    }
}

#[tauri::command]
pub fn license_delete(app: tauri::AppHandle) -> Result<bool, String> {
    let connection = open_connection(&app)?;
    crate::require_workspace_role_for_module(&connection, &["owner", "admin"])?;
    ensure_license_table(&connection)?;
    let deleted = connection
        .execute("DELETE FROM license_records WHERE id=1", [])
        .map_err(|error| error.to_string())?;
    Ok(deleted == 1)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_extra_token_segments() {
        assert!(decode_token("a.b.c").is_err());
    }

    #[test]
    fn rejects_expiry_before_issue() {
        let payload = LicensePayload {
            license_id: "lic".to_string(),
            plan: "basic".to_string(),
            subject: "customer".to_string(),
            issued_at: "2026-09-24T00:00:00Z".to_string(),
            expires_at: Some("2026-09-23T00:00:00Z".to_string()),
            max_devices: 1,
            account_limit: 1,
            features: vec![],
        };
        assert!(validate_payload(&payload).is_err());
    }

    #[test]
    fn public_key_decodes_to_32_bytes() {
        let bytes = B64.decode(LICENSE_PUBLIC_KEY_B64).expect("public key base64");
        assert_eq!(bytes.len(), 32);
    }
}
