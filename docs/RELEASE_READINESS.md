# ORBIT Marketing OS — Release Readiness

## Implemented on `feat/foundation-local-first`

The current branch contains a working implementation baseline for:

- strict TypeScript workspace configuration;
- `@orbit/core` domain types;
- campaign/task validation;
- typed task queue with exponential retry;
- AES-256-GCM authenticated encryption;
- sensitive-field redaction;
- audit logging;
- offline Ed25519 license verification;
- SQLite schema baseline;
- compliant connector contract with explicit user confirmation;
- Tauri v2 desktop shell;
- Rust Argon2id-derived AES-256-GCM local vault;
- encrypted local session storage for account records;
- local account list/create/delete operations;
- local Ollama runtime for chat/content/vision;
- Next.js static landing/PWA/pricing/legal surfaces;
- Expo mobile runtime monitoring screen.

## Still required before commercial launch

These are not declared complete:

- produce and commit `pnpm-lock.yaml`;
- run the complete workspace install/build/test suite on a clean machine;
- run Rust `cargo fmt`, `cargo test`, and `cargo clippy -D warnings`;
- connect real platform integrations using supported authorization mechanisms;
- implement and test CRM/inbox/campaign persistence UI against the native store;
- implement encrypted CRDT transport and backup providers;
- configure production payment processor and business account;
- obtain Apple/Google signing credentials and produce store artifacts;
- obtain Windows/macOS signing credentials and notarization setup;
- execute long-running performance/security testing on representative machines.

No launch status should be changed to “production ready” until those gates have evidence.

## Platform safety

The product intentionally does not implement fingerprint spoofing, stealth browser plugins, CAPTCHA bypass, anti-abuse evasion, or concealed automation. External workflows stop on authentication/challenge states and require appropriate user intervention.
