# ORBIT Product Surface Matrix

Updated: 2026-09-24

| Surface | Implemented | Verified runtime | Release state |
|---|---:|---:|---|
| Core domain | yes | partial/source + unit tests | UNVERIFIED |
| Desktop Tauri shell | yes | no clean native run yet | UNVERIFIED |
| Desktop SQLite/vault/backup | yes | native tests pending | UNVERIFIED |
| Desktop campaigns/tasks/CRM/inbox | yes | native integration pending | UNVERIFIED |
| Web public/PWA | yes | Playwright configured; runner unavailable | UNVERIFIED |
| Mobile Expo control surface | yes | clean Expo build pending | UNVERIFIED |
| Telegram connector | yes | controlled live/API evidence pending | UNVERIFIED |
| Facebook connector | contract + fixture | no real connector | NOT_IMPLEMENTED |
| Instagram connector | contract + fixture | no real connector | NOT_IMPLEMENTED |
| WhatsApp connector | contract + fixture | no real connector | NOT_IMPLEMENTED |
| LinkedIn connector | yes | controlled live/API evidence pending | UNVERIFIED |
| TikTok connector | contract + fixture | no real connector | NOT_IMPLEMENTED |
| Local Ollama runtime | yes | runtime smoke blocked by runner | UNVERIFIED |
| Offline licensing | yes | native/runtime evidence pending | UNVERIFIED |
| Distribution/signing | pipeline defined | signing artifacts not available | UNVERIFIED |

## Important interpretation

A UI option, type, fixture, or pipeline definition is not evidence of a working production integration. Each row changes state only when its corresponding acceptance evidence exists.

The current repository is intentionally allowed to ship a public/product surface before every external connector is implemented, but the release manifest must not imply that unsupported platforms are production integrations.
