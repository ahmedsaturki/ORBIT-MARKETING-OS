# ORBIT Platform SDK Foundation

Updated: 2026-09-26.

The Platform SDK foundation makes the future ORBIT extension ecosystem explicit without creating a second runtime or an uncontrolled plugin loader.

## Supported extension kinds

- `connector`: a platform integration that declares capabilities, auth modes and required permissions.
- `agent`: a future governed agent package.
- `workflow`: a future reusable workflow package.
- `vertical_pack`: a reusable industry operating model.

Every extension manifest declares an ID, semantic version, vendor, minimum ORBIT version, capabilities, required permissions, and default enablement.

## Connector boundary

A connector must declare platform identity, authentication modes, webhook support, capability IDs, required scopes, and externally-visible risk.

Official APIs remain preferred. Browser execution is permitted only as a user-authorized session mode and must declare an explicit `browser:authorized-session` permission.

The contract does not provide CAPTCHA bypass, fingerprint spoofing, stealth evasion, credential exfiltration, or unauthorized bulk actions.

## Vertical packs

A vertical pack declares vertical identity, a default governed policy pack, CRM lifecycle stages, domain object types, and reusable workflow IDs.

Vertical packs are configuration/contracts over the shared runtime, not duplicated applications.

## Registry boundary

`PlatformRegistry` validates manifests and stores defensive copies, but does not load arbitrary code, invoke connectors, grant authorization, or bypass the canonical CommandDispatcher.

Later SDK packages can split these contracts into `@orbit/connector-sdk`, `@orbit/agent-sdk`, `@orbit/workflow-sdk`, and `@orbit/vertical-sdk` without changing the governance model.

## Release gate

Manifest contracts are implemented and unit-tested. A signed third-party extension loader and third-party connector execution remain separate release gates and require dedicated runtime evidence.
