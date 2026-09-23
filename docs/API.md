# ORBIT API

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

The runtime returns a local provider result.

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

Requires OLLAMA_VISION_MODEL. Accepts imageBase64 plus an analysisType.

## Desktop IPC

Native commands include:

- app_health
- vault_put / vault_get / vault_delete
- account_upsert / account_list / account_get_session / account_delete
- campaign_create / campaign_list
- task_enqueue / task_claim_next / task_set_status / task_list
- contact_upsert / contact_list
- backup_create / backup_list / backup_restore

IPC contracts should be changed together with the React client and tested as a compatibility surface.
