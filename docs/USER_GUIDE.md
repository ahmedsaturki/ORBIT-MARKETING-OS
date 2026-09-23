# ORBIT Marketing OS User Guide

## First run

1. Start the desktop runtime.
2. Create/choose the local vault password.
3. Add an account by entering its local metadata.
4. Store a session payload only when you have explicitly authorized the session and understand the platform rules.
5. Create campaigns and tasks.
6. Review safety status before external actions.
7. Create an encrypted backup.

## Local AI

Install Ollama locally and configure the runtime variables:

```
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.1:8b
OLLAMA_FAST_MODEL=llama3.1:8b
OLLAMA_REASONING_MODEL=llama3.1:8b
OLLAMA_VISION_MODEL=
```

The application reports an offline/degraded state when Ollama is not reachable.

## Safety

The runtime can block work after the local daily budget or consecutive failure threshold is reached. Authentication challenges and unexpected platform states require human intervention.

The product does not bypass CAPTCHAs, spoof fingerprints, or attempt to hide automated behavior.

## Backup and restore

Use the desktop backup controls to create an encrypted .orbitbackup file. Restore validates SQLite integrity before replacing the active database and keeps a previous database as a rollback file when possible.

## Web and mobile

The web app is for product information, pricing, and legal content. The mobile app is a monitoring client; sensitive runtime state remains on the local desktop runtime.
