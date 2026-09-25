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

The Desktop client targets the local runtime at `http://127.0.0.1:3000`. The runtime rejects remote Ollama targets by default and does not act as a general-purpose cloud proxy.

Request:

```json
{
  "messages": [{ "role": "user", "text": "..." }],
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

### Content, approvals, campaigns and tasks

- `content_upsert`
- `content_list`
- `campaign_attach_content`
- `campaign_create`
- `campaign_list`
- `approval_request`
- `approval_decide`
- `approval_list`
- `task_enqueue`
- `task_claim_next`
- `task_fail`
- `task_set_status`
- `task_list`

`task_enqueue` accepts an optional `idempotency_key`; task persistence is workspace-scoped. Non-sync external tasks require `content_id` and `destination_id`. Approval changes are workspace-scoped and must remain bound to the referenced content.

### Content variants and analytics

- `content_variant_upsert`
- `content_variant_list`
- `analytics_summary`

Content variants are workspace-scoped through their parent content item. Analytics can be scoped to a campaign and is derived from persisted task outcomes.

### Media and automation

- `media_asset_upsert`
- `media_asset_import`
- `media_asset_delete`
- `media_asset_list`
- `automation_rule_pack_upsert`
- `automation_rule_pack_set_enabled`
- `automation_rule_pack_list`

Media commands persist metadata only; local file bytes are not uploaded implicitly. Rule packs are schema-versioned JSON and external actions require confirmation.

### Knowledge Fabric

- `knowledge_source_upsert`
- `knowledge_source_list`
- `knowledge_item_upsert`
- `knowledge_item_list`
- `knowledge_evidence_add`
- `knowledge_evidence_list`

Knowledge records are local and workspace-scoped. A knowledge item must reference at least one source in the same workspace; evidence is represented by a deterministic excerpt hash rather than storing sensitive excerpts in the graph layer. Trust levels are explicit and expirations are normalized to UTC timestamps.

### Marketing Brain / strategy

- `objective_upsert`
- `objective_list`
- `audience_upsert`
- `audience_list`
- `offer_upsert`
- `offer_list`
- `strategy_upsert`
- `strategy_list`

These commands persist the strategy model locally. Writes are role-gated to the active workspace. Strategy reference IDs are verified against the same workspace before persistence, so an Objective/Audience/Offer from another workspace cannot be attached silently.

### Agents, policies and work graph

- `agent_upsert`
- `agent_list`
- `agent_run_create`
- `agent_run_set_status`
- `agent_run_list`
- `policy_upsert`
- `policy_list`
- `work_item_upsert`
- `work_item_list`
- `work_dependency_upsert`
- `work_dependency_list`

Agent definitions are workspace-scoped and explicitly bounded by autonomy, tool grants, knowledge scope, and maximum steps. Agent runs cannot be created for disabled agents or agents outside the active workspace. Policy writes are owner/admin gated. Work dependencies require both referenced work items to belong to the active workspace and reject self-dependencies.

### Outcomes and learning

- `opportunity_upsert`
- `opportunity_list`
- `insight_upsert`
- `insight_list`

Opportunities are workspace-scoped CRM outcomes linked to a contact and optionally a campaign. Values are non-negative, probability is bounded to 0–100, and currency uses a three-letter uppercase code. Insights are workspace-scoped, evidence-oriented records with explicit kind, confidence, source IDs, and UTC-normalized observation time.

### Operating graph

- `operational_link_upsert`
- `operational_link_list`
- `operational_link_delete`

Operating links are strictly scoped to the active workspace and validate both endpoint entities before persistence. The runtime accepts only persisted operating entity types; self-links, unknown entities, and cross-workspace references are rejected. Relations use the same lowercase identifier contract as the core graph kernel.

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
- `license_install`
- `license_status`
- `license_delete`

Backups are encrypted locally and restore performs SQLite integrity validation before replacement. Audit records are workspace-scoped. License installation and removal are role-gated and verified offline using the embedded Ed25519 public key.

## Compatibility rule

When an IPC command changes, update the desktop client, this API contract, and its integration tests together. Source inspection alone is not release evidence.
