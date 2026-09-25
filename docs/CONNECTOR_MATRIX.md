# Connector Capability Matrix

Updated: 2026-09-24

## Current implementation evidence

| Platform  | Core type | Connector contract | Fixture | Real API connector | Verified runtime |
| --------- | --------- | -----------------: | ------: | -----------------: | ---------------: |
| Telegram  | yes       |                yes |     yes |                yes |       UNVERIFIED |
| Facebook  | yes       |                yes |     yes |                 no |       UNVERIFIED |
| Instagram | yes       |                yes |     yes |                 no |       UNVERIFIED |
| WhatsApp  | yes       |                yes |     yes |                 no |       UNVERIFIED |
| LinkedIn  | yes       |                yes |     yes |                yes |       UNVERIFIED |
| TikTok    | yes       |                yes |     yes |                 no |       UNVERIFIED |

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

## LinkedIn connector scope

The current LinkedIn adapter targets text publishing through the Posts API. It requires an application-supplied access token, an author URN resolver, explicit user confirmation, and a pinned LinkedIn API version in YYYYMM form. It does not claim inbox, comments, analytics, or media capabilities.

The adapter does not call LinkedIn OIDC userinfo during connection because that is a separate OIDC scope family from the publishing capability.
