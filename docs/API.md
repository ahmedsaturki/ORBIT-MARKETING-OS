# ORBIT API

## Workspace context

- `workspace_list`
- `workspace_current`
- `workspace_create`
- `workspace_select`

The active workspace is persisted locally and is applied to workspace-scoped desktop commands. Sensitive records remain local to the selected workspace context.

## Local runtime

### GET /api/health

Returns local runtime state and configured Ollama profiles.

### POST /api/chat

Request:
```json
{
  "messages": [{"role": "user", "text": "..." }],
  "roleId": "marketing_strategist",
  "profile": "balanced"
}
```

### POST /api/generate-content

Request:
```json
{
  "topic": "موضوع الحملة",
  "dialect": "فصحى مبسطة",
  "tone": "احترافي",
  "targetAudience": "الجمهور العام"
}
```

### POST /api/analyze-image

Requires `OLLAMA_VISION_MODEL`. Accepts `imageBase64` plus an `analysisType`.

## Desktop IPC

### Health and vault

- `app_health`
- `vault_put`
- `vault_get`
- `vault_delete`

### Accounts

- `account_upsert`
- `account_list`
- `account_get_session`
- `account_delete`

Optional session material is encrypted locally before persistence.

### Campaigns and tasks

- `campaign_create`
- `campaign_list`
- `task_enqueue`
- `task_claim_next`
- `task_set_status`
- `task_list`

`task_enqueue` accepts an optional `idempotency_key`; task persistence is workspace-scoped. Non-sync external tasks require `content_id` and `destination_id`.

### CRM and inbox

- `contact_upsert`
- `contact_list`
- `conversation_upsert` (requires `account_id`; account platform must match conversation platform)
- `message_add`
- `inbox_list`
- `message_list`

Inbox message writes verify that the conversation belongs to the active local workspace.

### Telegram external execution

- `telegram_execute_task`

Required arguments: `task_id`, `vault_password`, and `user_confirmed=true`.
The command is workspace- and role-gated, requires a connected Telegram account and approved linked content, and stops for human verification on authentication challenges, rate limits, or ambiguous delivery status.

### Backup and audit

- `backup_create`
- `backup_list`
- `backup_restore`
- `audit_list`
- `audit_verify`

Backups are encrypted locally and restore performs SQLite integrity validation before replacement. Audit records are workspace-scoped.

## Compatibility rule

When an IPC command changes, update the desktop client, this API contract, and its integration tests together. Source inspection alone is not release evidence.
