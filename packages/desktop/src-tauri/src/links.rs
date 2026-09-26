use rusqlite::{params, Connection};
use serde::Serialize;
use tauri::AppHandle;

use crate::{
    active_workspace_id_for_module, append_audit_event_for_module,
    open_db_for_module, require_workspace_role_for_module,
};

#[derive(Debug, Serialize)]
pub(crate) struct MarketingLinkView {
    pub id: String,
    pub workspace_id: String,
    pub link_key: String,
    pub destination_url: String,
    pub tracked_url: String,
    pub tracking_json: String,
    pub campaign_id: Option<String>,
    pub content_id: Option<String>,
    pub provenance: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
pub(crate) struct MarketingLinkEvidenceView {
    pub id: String,
    pub workspace_id: String,
    pub link_id: String,
    pub source_type: String,
    pub metric_name: String,
    pub metric_value: f64,
    pub observed_at: String,
    pub source_locator: Option<String>,
    pub provenance: String,
    pub metadata_json: String,
    pub created_at: String,
}

fn validate_text(value: &str, name: &str, max_len: usize) -> Result<String, String> {
    let normalized = value.trim();
    if normalized.is_empty() || normalized.chars().count() > max_len {
        return Err(format!("{name} is invalid"));
    }
    if normalized.chars().any(|c| c.is_control()) {
        return Err(format!("{name} contains invalid control characters"));
    }
    Ok(normalized.to_string())
}

fn validate_link_key(value: &str) -> Result<String, String> {
    let key = validate_text(value, "link_key", 64)?;
    if !key
        .strip_prefix("lnk_")
        .is_some_and(|suffix| suffix.len() == 8 && suffix.chars().all(|c| c.is_ascii_hexdigit()))
    {
        return Err("link_key must be a deterministic lnk_XXXXXXXX key".to_string());
    }
    Ok(key)
}

fn validate_http_url(value: &str, name: &str) -> Result<String, String> {
    let url = validate_text(value, name, 4096)?;
    let lower = url.to_ascii_lowercase();
    if !(lower.starts_with("http://") || lower.starts_with("https://")) {
        return Err(format!("{name} must use http or https"));
    }
    if url.contains("\\") || url.contains("javascript:") || url.contains("data:") {
        return Err(format!("{name} contains a disallowed URL form"));
    }
    Ok(url)
}

fn validate_json(value: &str, name: &str, max_len: usize) -> Result<String, String> {
    let normalized = validate_text(value, name, max_len)?;
    serde_json::from_str::<serde_json::Value>(&normalized)
        .map_err(|_| format!("{name} must be valid JSON"))?;
    Ok(normalized)
}

fn validate_provenance(value: &str) -> Result<String, String> {
    let provenance = validate_text(value, "provenance", 64)?;
    match provenance.as_str() {
        "platform_observed" | "manual_observation" | "imported_export" | "verified_external" => {
            Ok(provenance)
        }
        _ => Err("unsupported evidence provenance".to_string()),
    }
}

fn validate_observed_source(value: &str) -> Result<String, String> {
    let source = validate_text(value, "source_type", 64)?;
    match source.as_str() {
        "platform_api" | "platform_export" | "manual" | "web_observation" | "import" => {
            Ok(source)
        }
        _ => Err("unsupported evidence source type".to_string()),
    }
}

fn link_id(workspace_id: &str, link_key: &str) -> String {
    format!("{workspace_id}:{link_key}")
}

fn ensure_link_references_same_workspace(
    connection: &Connection,
    workspace_id: &str,
    campaign_id: Option<&str>,
    content_id: Option<&str>,
) -> Result<(), String> {
    if let Some(id) = campaign_id {
        let exists: bool = connection
            .query_row(
                "SELECT EXISTS(
                   SELECT 1 FROM campaigns
                   WHERE id=?1 AND workspace_id=?2
                 )",
                params![id, workspace_id],
                |row| row.get(0),
            )
            .map_err(|error| error.to_string())?;
        if !exists {
            return Err("campaign does not exist in active workspace".to_string());
        }
    }

    if let Some(id) = content_id {
        let exists: bool = connection
            .query_row(
                "SELECT EXISTS(
                   SELECT 1 FROM content_items
                   WHERE id=?1 AND workspace_id=?2
                 )",
                params![id, workspace_id],
                |row| row.get(0),
            )
            .map_err(|error| error.to_string())?;
        if !exists {
            return Err("content does not exist in active workspace".to_string());
        }
    }

    Ok(())
}

#[tauri::command]
pub(crate) fn marketing_link_upsert(
    app: AppHandle,
    link_key: String,
    destination_url: String,
    tracked_url: String,
    tracking_json: String,
    campaign_id: Option<String>,
    content_id: Option<String>,
) -> Result<MarketingLinkView, String> {
    let workspace_id = active_workspace_id_for_module();
    let link_key = validate_link_key(&link_key)?;
    let destination_url = validate_http_url(&destination_url, "destination_url")?;
    let tracked_url = validate_http_url(&tracked_url, "tracked_url")?;
    let tracking_json = validate_json(&tracking_json, "tracking_json", 4096)?;
    let campaign_id = campaign_id
        .map(|value| validate_text(&value, "campaign_id", 200))
        .transpose()?;
    let content_id = content_id
        .map(|value| validate_text(&value, "content_id", 200))
        .transpose()?;

    let connection = open_db_for_module(&app)?;
    require_workspace_role_for_module(
        &connection,
        &workspace_id,
        &["owner", "admin", "editor"],
    )?;
    ensure_link_references_same_workspace(
        &connection,
        &workspace_id,
        campaign_id.as_deref(),
        content_id.as_deref(),
    )?;

    let id = link_id(&workspace_id, &link_key);
    let now = chrono_like_timestamp();
    connection
        .execute(
            "INSERT INTO marketing_links(
               id, workspace_id, link_key, destination_url, tracked_url, tracking_json,
               campaign_id, content_id, provenance, created_at, updated_at
             )
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'local', ?9, ?9)
             ON CONFLICT(workspace_id, link_key)
             DO UPDATE SET
               destination_url=excluded.destination_url,
               tracked_url=excluded.tracked_url,
               tracking_json=excluded.tracking_json,
               campaign_id=excluded.campaign_id,
               content_id=excluded.content_id,
               updated_at=excluded.updated_at",
            params![
                id,
                workspace_id,
                link_key,
                destination_url,
                tracked_url,
                tracking_json,
                campaign_id,
                content_id,
                now
            ],
        )
        .map_err(|error| error.to_string())?;

    append_audit_event_for_module(
        &connection,
        &workspace_id,
        "marketing_link",
        "upsert",
        "success",
        "user",
        Some(&id),
    )?;

    connection
        .query_row(
            "SELECT id, workspace_id, link_key, destination_url, tracked_url, tracking_json,
                    campaign_id, content_id, provenance, created_at, updated_at
             FROM marketing_links
             WHERE id=?1 AND workspace_id=?2",
            params![id, workspace_id],
            |row| {
                Ok(MarketingLinkView {
                    id: row.get(0)?,
                    workspace_id: row.get(1)?,
                    link_key: row.get(2)?,
                    destination_url: row.get(3)?,
                    tracked_url: row.get(4)?,
                    tracking_json: row.get(5)?,
                    campaign_id: row.get(6)?,
                    content_id: row.get(7)?,
                    provenance: row.get(8)?,
                    created_at: row.get(9)?,
                    updated_at: row.get(10)?,
                })
            },
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) fn marketing_link_list(app: AppHandle) -> Result<Vec<MarketingLinkView>, String> {
    let workspace_id = active_workspace_id_for_module();
    let connection = open_db_for_module(&app)?;
    require_workspace_role_for_module(
        &connection,
        &workspace_id,
        &["owner", "admin", "editor", "operator", "reviewer", "viewer"],
    )?;

    let mut statement = connection
        .prepare(
            "SELECT id, workspace_id, link_key, destination_url, tracked_url, tracking_json,
                    campaign_id, content_id, provenance, created_at, updated_at
             FROM marketing_links
             WHERE workspace_id=?1
             ORDER BY updated_at DESC, link_key ASC",
        )
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map(params![workspace_id], |row| {
            Ok(MarketingLinkView {
                id: row.get(0)?,
                workspace_id: row.get(1)?,
                link_key: row.get(2)?,
                destination_url: row.get(3)?,
                tracked_url: row.get(4)?,
                tracking_json: row.get(5)?,
                campaign_id: row.get(6)?,
                content_id: row.get(7)?,
                provenance: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) fn marketing_link_evidence_add(
    app: AppHandle,
    link_id: String,
    source_type: String,
    metric_name: String,
    metric_value: f64,
    observed_at: String,
    source_locator: Option<String>,
    provenance: String,
    metadata_json: String,
) -> Result<MarketingLinkEvidenceView, String> {
    let workspace_id = active_workspace_id_for_module();
    let link_id = validate_text(&link_id, "link_id", 300)?;
    let source_type = validate_observed_source(&source_type)?;
    let metric_name = validate_text(&metric_name, "metric_name", 100)?;
    let observed_at = validate_text(&observed_at, "observed_at", 80)?;
    let provenance = validate_provenance(&provenance)?;
    let metadata_json = validate_json(&metadata_json, "metadata_json", 8192)?;
    let source_locator = source_locator
        .map(|value| validate_http_url(&value, "source_locator"))
        .transpose()?;

    if !metric_value.is_finite() || metric_value < 0.0 {
        return Err("metric_value must be finite and non-negative".to_string());
    }

    let connection = open_db_for_module(&app)?;
    require_workspace_role_for_module(
        &connection,
        &workspace_id,
        &["owner", "admin", "editor", "operator"],
    )?;

    let exists: bool = connection
        .query_row(
            "SELECT EXISTS(
               SELECT 1 FROM marketing_links
               WHERE id=?1 AND workspace_id=?2
             )",
            params![link_id, workspace_id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    if !exists {
        return Err("marketing link does not exist in active workspace".to_string());
    }

    let id = uuid_like();
    let created_at = chrono_like_timestamp();
    connection
        .execute(
            "INSERT INTO marketing_link_evidence(
               id, workspace_id, link_id, source_type, metric_name, metric_value,
               observed_at, source_locator, provenance, metadata_json, created_at
             )
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
             ON CONFLICT(
               workspace_id, link_id, source_type, metric_name, observed_at, source_locator
             )
             DO UPDATE SET
               metric_value=excluded.metric_value,
               provenance=excluded.provenance,
               metadata_json=excluded.metadata_json",
            params![
                id,
                workspace_id,
                link_id,
                source_type,
                metric_name,
                metric_value,
                observed_at,
                source_locator,
                provenance,
                metadata_json,
                created_at
            ],
        )
        .map_err(|error| error.to_string())?;

    append_audit_event_for_module(
        &connection,
        &workspace_id,
        "marketing_link_evidence",
        "add",
        "success",
        "user",
        Some(&link_id),
    )?;

    connection
        .query_row(
            "SELECT id, workspace_id, link_id, source_type, metric_name, metric_value,
                    observed_at, source_locator, provenance, metadata_json, created_at
             FROM marketing_link_evidence
             WHERE workspace_id=?1
               AND link_id=?2
               AND source_type=?3
               AND metric_name=?4
               AND observed_at=?5
               AND (source_locator IS ?6 OR source_locator=?6)
             ORDER BY rowid DESC
             LIMIT 1",
            params![
                workspace_id,
                link_id,
                source_type,
                metric_name,
                observed_at,
                source_locator
            ],
            |row| {
                Ok(MarketingLinkEvidenceView {
                    id: row.get(0)?,
                    workspace_id: row.get(1)?,
                    link_id: row.get(2)?,
                    source_type: row.get(3)?,
                    metric_name: row.get(4)?,
                    metric_value: row.get(5)?,
                    observed_at: row.get(6)?,
                    source_locator: row.get(7)?,
                    provenance: row.get(8)?,
                    metadata_json: row.get(9)?,
                    created_at: row.get(10)?,
                })
            },
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) fn marketing_link_evidence_list(
    app: AppHandle,
    link_id: Option<String>,
) -> Result<Vec<MarketingLinkEvidenceView>, String> {
    let workspace_id = active_workspace_id_for_module();
    let normalized_link_id = link_id
        .map(|value| validate_text(&value, "link_id", 300))
        .transpose()?;

    let connection = open_db_for_module(&app)?;
    require_workspace_role_for_module(
        &connection,
        &workspace_id,
        &["owner", "admin", "editor", "operator", "reviewer", "viewer"],
    )?;

    if let Some(ref id) = normalized_link_id {
        let exists: bool = connection
            .query_row(
                "SELECT EXISTS(
                   SELECT 1 FROM marketing_links
                   WHERE id=?1 AND workspace_id=?2
                 )",
                params![id, workspace_id],
                |row| row.get(0),
            )
            .map_err(|error| error.to_string())?;
        if !exists {
            return Err("marketing link does not exist in active workspace".to_string());
        }
    }

    let mut statement = connection
        .prepare(
            "SELECT id, workspace_id, link_id, source_type, metric_name, metric_value,
                    observed_at, source_locator, provenance, metadata_json, created_at
             FROM marketing_link_evidence
             WHERE workspace_id=?1
               AND (?2 IS NULL OR link_id=?2)
             ORDER BY observed_at DESC, rowid DESC",
        )
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map(params![workspace_id, normalized_link_id], |row| {
            Ok(MarketingLinkEvidenceView {
                id: row.get(0)?,
                workspace_id: row.get(1)?,
                link_id: row.get(2)?,
                source_type: row.get(3)?,
                metric_name: row.get(4)?,
                metric_value: row.get(5)?,
                observed_at: row.get(6)?,
                source_locator: row.get(7)?,
                provenance: row.get(8)?,
                metadata_json: row.get(9)?,
                created_at: row.get(10)?,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}
