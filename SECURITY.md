# Security Model

ORBIT MARKETING OS is designed as a local-first application. Sensitive user data should remain on the user's device unless the user explicitly enables a supported integration.

## Protected data

Examples include:

- social account access tokens and session material;
- locally stored CRM data;
- private campaign content;
- local AI prompts containing business information;
- encrypted backups.

## Required controls

- Encrypt sensitive data at rest using authenticated encryption.
- Derive local vault keys from a user-controlled secret with a memory-hard KDF.
- Redact credentials and tokens from logs and telemetry.
- Keep platform connectors isolated from core business logic.
- Fail closed when authentication, consent, or platform safety state is unknown.
- Require explicit user confirmation before externally-visible actions when the integration cannot provide a reliable authorization/safety state.

## Platform automation

The product may integrate with supported platform APIs or user-authorized browser sessions. It must not attempt to evade security, abuse-prevention, CAPTCHAs, fingerprinting, access controls, or platform restrictions.

## Incident handling

Report suspected credential leakage, unauthorized access, or data exposure as a security issue. Do not include live credentials, session cookies, API keys, or private user data in issue reports.
