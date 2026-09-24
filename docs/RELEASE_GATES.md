# ORBIT MARKETING OS — Release Gates

A release candidate may only be promoted when every applicable gate is PASS.

## Gate 1 — Source integrity

- clean generated artifacts policy
- no placeholder implementation
- no production TODO/FIXME markers
- strict TypeScript
- Rust clippy and rustfmt where Rust exists

## Gate 2 — Build

- workspace install is reproducible
- typecheck passes
- unit/integration tests pass
- production builds pass
- format/lint gates pass

## Gate 3 — Security

- secret redaction tests
- encryption/decryption negative tests
- workspace isolation tests
- authorization/approval tests
- dependency/security review
- no credentials in artifacts or logs

## Gate 4 — Runtime

- queue recovery
- idempotency
- circuit breaker
- connector challenge handling
- offline behavior
- crash/restart recovery

## Gate 5 — Product

- content workflow
- campaign workflow
- approval workflow
- inbox/CRM workflow
- analytics correctness
- RTL/accessibility
- empty/loading/error states

## Gate 6 — Performance

- startup budget
- idle/active memory budget
- queue throughput
- database query latency
- UI responsiveness
- 24-hour soak evidence

## Gate 7 — Distribution

- Windows installer
- macOS package/signing where credentials are available
- Linux packages
- Android artifact
- iOS/TestFlight artifact where Apple signing is available
- web deployment
- update/rollback verification

## Gate 8 — Documentation

- operations runbook and recovery procedures

- architecture
- user guide
- operations guide
- security/privacy
- release notes
- recovery procedures

## Promotion rule

No single green check substitutes for a missing gate. The release record must contain evidence for each applicable gate.
