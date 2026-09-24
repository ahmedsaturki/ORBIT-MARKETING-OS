# Connector Capability Matrix

Updated: 2026-09-24

## Current implementation evidence

| Platform | Core type | Connector contract | Fixture | Real API connector | Verified runtime |
|---|---|---:|---:|---:|---:|
| Telegram | yes | yes | yes | yes | UNVERIFIED |
| Facebook | yes | yes | yes | no | UNVERIFIED |
| Instagram | yes | yes | yes | no | UNVERIFIED |
| WhatsApp | yes | yes | yes | no | UNVERIFIED |
| LinkedIn | yes | yes | yes | no | UNVERIFIED |
| TikTok | yes | yes | yes | no | UNVERIFIED |

## Connector rules

Every real connector must:

- expose only the capabilities it actually implements;
- require an explicit user-authorized context before external side effects;
- fail closed on unsupported actions;
- surface authentication/rate-limit/challenge states as typed outcomes;
- never store credentials, cookies, or tokens in normal logs;
- never implement fingerprint spoofing, CAPTCHA bypass, anti-abuse evasion, or concealed automation.

## Release rule

The platform list in the product UI is not evidence that a platform connector is production-ready. A connector becomes release-eligible only after its real authorization flow, controlled runtime tests, failure recovery, challenge handling, audit behavior, and platform-policy review are evidenced.
