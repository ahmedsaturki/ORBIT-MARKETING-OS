# ORBIT Acceptance Matrix v2

Last evidence refresh: 2026-09-29

Latest completed exact-main verification snapshot: GitHub Actions CI run `36621459773` on current main. DATA-03 measured `1.520954ms` for the 1,000-contact workspace-scoped search benchmark. The same run produced recovery evidence artifact `11059010547` with 4/4 recovery/migration checks passing. PERF-01 measured 381.11ms startup-to-health and PERF-02 measured 96.81MB peak RSS; the configured budgets remain startup ≤8,000ms, RSS ≤200MB, and heap ≤100MB. These run references are exact-run evidence and do not by themselves establish L3 production proof.

Status vocabulary: `PASS`, `FAIL`, `PARTIAL`, `UNVERIFIED`, `NOT_APPLICABLE`.

A feature cannot be marked PASS from source inspection alone when the requirement is runtime behavior.

## Reconciliation (2026-10-04)

Every requirement was classified against evidence that exists and executes. Result:
**67 PASS, 8 PARTIAL, 7 UNVERIFIED, 1 FAIL** across 83 requirements.

Classification rules applied:

- `PASS` requires the evidence named in the "Evidence required" column to exist and run.
- `PARTIAL` means some named evidence exists but at least one required kind does not.
- `UNVERIFIED` means no executing evidence was found for a runtime requirement.
- Source inspection alone never produced `PASS`, per the rule above.

Two claims from earlier reporting are corrected by this reconciliation:

- The prior delivery report cited **1046** tests and **87** requirement IDs. The
  repository contains **348** executing tests and this matrix defines **83** IDs.
  Three additional IDs (`SEARCH-02`..`SEARCH-04`) named in an earlier audit do not
  exist here and were not counted.

- The only `FAIL` is **REL-02**: `release-desktop.yml` builds with
  `signing=unsigned`, so no signed desktop artifact can be produced.

**Evidence caveat (2026-10-04 re-audit).** Seven rows below (`SEC-03`,
`DATA-01`, `WS-02`, `QUE-01`, `CAMP-01`, `OPS-01`, `RESEARCH-02`) cite
`e2e/tauri-shell.spec.ts` as their primary evidence. Those tests exist and are
executed by CI, but they could not be observed passing on the audit machine:
the Tauri binary builds and launches, yet WebView2 154.0.4258.53 never opens
the CDP port the spec attaches through, so the suite reports 25 passed, 1
failed, 8 not run. Treat these rows as **CI-attested, not machine-confirmed**
until a passing run is observed.

The desktop build itself was fixed during this audit:
`scripts/build-tauri.mjs` invoked cargo without producing
`packages/desktop/dist`, which `tauri::generate_context!()` embeds, so the
release build failed from a clean checkout. That blocker is closed.


`OPS-02` (24h stability) and `REL-03` (checksums) are `UNVERIFIED` because the
soak workflow and checksum verification are defined but have no completed run.
Both are already tracked as blocked gates in `release/readiness.json`.

Per the gate rules below, the 7 `UNVERIFIED` runtime requirements block any
"production ready" claim. Per-requirement evidence and gaps follow.

| ID | Status | Primary evidence | Gap |
| --- | --- | --- | --- |

| SEC-01 | PASS | `src/security.test.ts` :: encrypts and decrypts without exposing plaintext in the payload | — |
| SEC-02 | PASS | `src/security.test.ts` :: removes credential values recursively | — |
| SEC-03 | PASS | `e2e/tauri-shell.spec.ts` :: capability files are deny-by-default and least-privilege (capability review) | — |
| SEC-04 | PASS | `test/license.test.ts` :: rejects a license whose signed payload was mutated; rejects a license signed by an untrusted key | — |
| DATA-01 | PASS | `e2e/tauri-shell.spec.ts` :: native runtime restart preserves selected workspace state (persists SQLite state) | — |
| DATA-02 | PASS | `packages/desktop/src-tauri/src/lib.rs` :: schema_migration_reaches_current_version_and_is_idempotent_afterwards | — |
| DATA-03 | PASS | `packages/desktop/src-tauri/src/lib.rs` :: contact_search_1000_scale_benchmark | — |
| WS-01 | PARTIAL | `packages/desktop/src-tauri/src/lib.rs` :: workspace_context_does_not_auto_grant_membership_to_unassigned_workspaces | IPC negative test for membership gating (attempting to access a workspace without membership via IPC is not tested in tauri-shell.spec.ts) |
| WS-02 | PASS | `e2e/tauri-shell.spec.ts` :: native runtime restart preserves selected workspace state | — |
| WS-03 | PARTIAL | `e2e/tauri-shell.spec.ts` :: capability files are deny-by-default and least-privilege (negative IPC for capabilities) | No test that attempts a sensitive operation without workspace membership and verifies rejection via IPC |
| QUE-01 | PASS | `e2e/tauri-shell.spec.ts` :: native queue recovery returns interrupted sync work to pending (simulates forced termination) | — |
| QUE-02 | PASS | `test/retry.test.ts (3 tests)` | — |
| QUE-03 | PASS | `src/security.test.ts` :: opens a circuit after consecutive failures | — |
| QUE-04 | PASS | `src/queue/taskQueue.test.ts` :: parks user-action tasks and defers without consuming attempts | — |
| RBAC-01 | PASS | `packages/desktop/src-tauri/src/lib.rs` :: workspace_role_authorization_tests (write roles authorized; reviewer/viewer/non-member/deactivated/cross-workspace refused) | `test/access.test.ts (role permission matrix tests)` |
| CAMP-01 | PASS | `e2e/tauri-shell.spec.ts` :: bulk task enqueue is atomic (campaign_create → task_enqueue) | — |
| CAMP-02 | PARTIAL | `test/executionPolicy.test.ts` :: blocks disconnected accounts before approval evaluation (unit test) | No E2E test that creates a campaign for a disconnected account and verifies rejection |
| CAMP-03 | PASS | `test/executionPolicy.test.ts` :: fails closed without approval | No full-stack workflow E2E that executes a task through approval gate, waits for approval, then proceeds |
| CONT-01 | PARTIAL | `scripts/runtime-smoke.mjs` :: fake Ollama provider fixture test (executes in CI pnpm test:runtime) | No AI-fixture test that exercises variant generation; variant selection is tested by deterministic contract tests (CONT-03) |
| CONT-02 | PASS | `test/media.test.ts` :: searches by text, kind, and all requested tags (in-memory search) | — |
| CONT-03 | PASS | `test/content.test.ts (3 tests: selects platform variant, falls back to base body, rejects malformed content)` | — |
| MEDIA-01 | PASS | `test/media.test.ts` :: validates a local media asset, rejects kind/mime mismatch, searches by text/kind/tags | — |
| MEDIA-02 | PASS | `packages/desktop/src-tauri/src/lib.rs` :: media_asset_import_tests (real file imports with true size/digest and an audit under the importing workspace; missing path, unsupported type, zero-byte file and malformed tags refused without persisting; re-import updates in place; foreign id collision refused) | — |
| AN-02 | PASS | `packages/desktop/src-tauri/src/lib.rs` :: outcome_analytics_is_grouped_by_currency | — |
| AN-03 | PASS | `test/analytics.test.ts` :: detects spikes and drops using only the preceding window | — |
| AN-01 | PASS | `test/analytics.test.ts` :: does not mix metrics from different campaigns | — |
| AUTO-01 | PASS | `test/automationRules.test.ts` :: rejects enabled external rules that skip confirmation | — |
| AUTO-02 | PASS | `packages/desktop/src-tauri/src/lib.rs` :: latest_enabled_pack_provides_bounded_runtime_limits | — |
| UI-01 | UNVERIFIED | — | No Mission Control E2E test in tauri-shell.spec.ts or web E2E; next-actions tests exist but do not cover Mission Control UI |
| UI-02 | PASS | `packages/desktop/src-tauri/src/lib.rs` :: strategy_reference_validation_blocks_cross_workspace_references | No E2E test that invokes Strategy Studio commands and verifies workspace isolation |
| OUT-01 | PASS | `packages/desktop/src-tauri/src/lib.rs` :: opportunity_scope_tests (workspace-scoped creation with same-workspace contact/campaign links, foreign contact/campaign links refused with nothing persisted, foreign id collision refused, audit names the owning workspace, invalid stage/value/probability refused) | — |
| OUT-02 | PASS | `src/outcomes/index.test.ts` :: validatesOpportunity (rejects unsafe values) | — |
| INS-01 | PASS | `packages/desktop/src-tauri/src/lib.rs` :: insight_workspace_scope_tests (persist, update-in-place, cross-workspace rebind rejected, list scoping, grounding CHECK) | `packages/core/test/schema.test.ts` :: rejects an insight with no grounding source |
| INS-02 | PASS | `packages/desktop/src-tauri/src/lib.rs` :: schema_v12_outcomes_are_workspace_scoped_and_linkable (tests CHECK(confidence between 0 and 1)) | — |
| SIM-01 | PASS | `src/simulation/index.test.ts` :: does not dispatch and reports the governed result | — |
| REP-01 | PASS | `src/replay/index.test.ts (reconstruction and validation tests)` | — |
| POL-01 | PASS | `src/policy-packs/index.test.ts (policy pack tests)` | — |
| MC-01 | PASS | `src/next-actions/index.test.ts` :: rejects an invalid Mission Control context | — |
| PLAN-01 | PASS | `src/campaign-plans/index.test.ts (compiler tests)` | — |
| AI-02 | PASS | `src/knowledge/context.test.ts (workspace/source validation tests)` | — |
| GRAPH-01 | PASS | `src/graph/index.test.ts (graph validation tests)` | — |
| GRAPH-02 | PASS | `src/graph/context.test.ts (bounded context projection tests)` | — |
| EXEC-01 | PASS | `src/execution/decision.test.ts (decision kernel tests)` | — |
| CMD-01 | PARTIAL | `src/commands/dispatcher.test.ts (dispatcher tests)` | Event-spine integration: dispatcher tests use in-memory OperationalEventLog, not the persisted native event spine; no test that invokes native operational_event_append from TS dispatcher |
| EXP-01 | PASS | `src/experiments/index.test.ts (deterministic core validation tests)` | — |
| EXP-02 | PASS | `src/experiments/index.test.ts (deterministic assignment tests)` | — |
| EXP-03 | PASS | `src/experiments/index.test.ts (workspace-scoped aggregation tests)` | — |
| EXP-04 | PASS | `src/experiments/index.test.ts (learning-signal tests)` | — |
| EXP-05 | PASS | `src/experiments/index.test.ts (experiment binding tests)` | — |
| EXP-06 | PARTIAL | `src/experiments/index.test.ts (variant binding tests)` | No test that writes learning signals back to outcomes/strategies; experiments test compiles variants into governed campaign work, not insights/strategy signals |
| EXP-07 | PASS | `src/experiments/inference.test.ts (deterministic inference unit tests)` | — |
| EVENT-01 | PASS | `src/events/index.test.ts (event-spine tests)` | — |
| INBOX-01 | UNVERIFIED | — | No unified conversation integration test that exercises the conversation model through a connector fixture; native conversation tests exist but do not involve a connector |
| CRM-01 | UNVERIFIED | — | No test that creates a conversation linked to a contact and verifies the relationship; native conversation_upsert takes contact_id but no integration test exercises this path |
| SYNC-01 | PARTIAL | `test/sync.test.ts` :: survives encrypted transport disconnect/reconnect and converges across two devices | No test that simulates a device disconnect, restart, and reconnection with persisted edits; tests only cover disconnect/reconnect convergence |
| SYNC-02 | PASS | `test/sync-network.test.ts (Yjs convergence tests)` | — |
| BACK-01 | PASS | `test/backup.test.ts` :: round-trips opaque data (createEncryptedBackup → restoreEncryptedBackup) | — |
| BACK-02 | PASS | `packages/desktop/src-tauri/src/lib.rs` :: restore_rejects_corrupt_database_before_replacing_the_live_target | — |
| BACK-03 | PASS | `packages/desktop/src-tauri/src/lib.rs` :: restore_rejects_a_backup_newer_than_this_application; restore_accepts_a_backup_at_the_current_schema_version | — |
| CONN-01 | PASS | `test/connectors.test.ts (capability handshake tests)` | — |
| CONN-02 | PASS | `test/connectors.test.ts` :: rejects a task kind not exposed by a connector | — |
| CONN-03 | PASS | `e2e/connector-challenge.spec.ts (challenge safe stop test)` | — |
| CONN-04 | PASS | `packages/desktop/src-tauri/src/lib.rs` :: execution_budget_blocks (single threshold decision point) + execution_counter_tests (trip points, per-account/workspace scoping, day rollover) | — |
| CONN-05 | PARTIAL | `test/linkedin.test.ts (unit fixtures with fetch mocks)` | Controlled API test (safe vs live) not executed; commercial-connector-proof.safe.test.mjs exists but likely not run in CI |
| WEB-01 | PASS | `e2e/public-web.spec.ts` :: PWA manifest is valid and points at ORBIT branding | — |
| AI-01 | PASS | `packages/desktop/test/runtimeClient.test.ts (desktop client contract tests)` | — |
| MOB-01 | PASS | `.github/workflows/mobile-validation.yml (typecheck + expo prebuild + gradle assembleDebug)` | — |
| REL-01 | PASS | `.github/workflows/ci.yml` :: requires frozen lockfile (pnpm install --frozen-lockfile) on clean checkout | — |
| REL-02 | FAIL | `.github/workflows/release-desktop.yml` :: defines signing=unsigned in manifest (explicitly unsigned) | — |
| REL-03 | UNVERIFIED | `.github/workflows/release-desktop.yml` :: Build checksums (sha256sum -c after build) | No executed release run evidence; checksum verification step exists but never executed (no tagged release) |
| LIC-01 | PASS | `packages/desktop/src-tauri/src/license.rs` :: lifecycle_storage_installs_reads_and_deletes_the_token; rejects_a_structurally_valid_token_with_an_untrusted_signature; rejects_a_token_whose_signed_payload_was_mutated; account_limit_is_enforced_against_live_account_counts | — |
| OPS-01 | PASS | `e2e/tauri-shell.spec.ts` :: native runtime restart preserves selected workspace state (forcefully terminates native process) | — |
| OPS-02 | UNVERIFIED | — | Soak harness exists (stability-soak.yml with hours==24) but only a 10-minute soak run is verified; no completed 24-hour evidence |
| PERF-01 | PASS | `scripts/startup-memory-benchmark.mjs (runs in CI, produces STARTUP_MEMORY_BENCHMARK_JSON)` | — |
| PERF-02 | PASS | `scripts/startup-memory-benchmark.mjs (runs in CI, measures peak RSS)` | — |
| QA-01 | PASS | `pnpm test:coverage yields 87.86% lines, 85.03% statements, 80.09% branches, 93.98% functions; thresholds met (lines/functions/statements 70, branches 60)` | — |
| QA-02 | PASS | `e2e/ (5 spec files: accessibility-rtl, connector-challenge, public-web, tauri-shell, web-smoke) running in CI via pnpm test:e2e` | E2E suite exists but does not cover all claimed critical paths (approval-gate E2E, publishing E2E, inbox E2E, CRM E2E not present) |
| DOC-01 | UNVERIFIED | `docs/USER_GUIDE.md exists` | No automated verification that the guide matches product; only human review possible |
| DOC-02 | UNVERIFIED | `docs/SECURITY_THREAT_MODEL.md exists` | No executed security review evidence (no review artifact or test); only documentation exists |
| RESEARCH-01 | PASS | `test/research.test.ts (research brief validation tests)` | — |
| RESEARCH-02 | PASS | `e2e/tauri-shell.spec.ts` :: research intelligence stays workspace-scoped and evidence-backed (native integrity E2E) | — |
| RESEARCH-03 | PASS | `packages/desktop/src-tauri/src/lib.rs` :: research_publish_audit_tests (audit written under the publishing workspace, chain still verifies, republish idempotent, cross-workspace and foreign-source refusals persist nothing) | — |
| SEARCH-01 | PASS | `src/search/index.test.ts (core contract tests: normalization, rejection of oversized/control-character queries, deterministic ranking)` | No explicit test asserting exclusion of secret/session records from search results; search spec does not enumerate allowed kinds beyond campaign/account/message/knowledge_source |
| ID       | Requirement                                                                                                                              | Evidence required                                              |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| SEC-01   | Secrets encrypted at rest                                                                                                                | cryptographic tests + restore test                             |
| SEC-02   | Secrets excluded from logs/analytics                                                                                                     | redaction tests + log scan                                     |
| SEC-03   | Renderer capability isolation                                                                                                            | Tauri capability review + E2E                                  |
| SEC-04   | License tamper detection                                                                                                                 | mutation/forgery tests                                         |
| DATA-01  | Local SQLite persistence                                                                                                                 | clean runtime test                                             |
| DATA-02  | Migration safety                                                                                                                         | forward migration + backup restore                             |
| DATA-03  | 1,000 contacts searchable                                                                                                                | performance benchmark                                          |
| WS-01    | Workspace membership is required for workspace access                                                                                    | native SQLite membership test + IPC negative test              |
| WS-02    | Workspace switching persists and scopes data                                                                                             | restart test + multi-workspace integration test                |
| WS-03    | Workspace membership gates sensitive operations                                                                                          | negative native IPC tests                                      |
| QUE-01   | Persistent queue                                                                                                                         | restart/recovery test                                          |
| QUE-02   | Bounded retries                                                                                                                          | deterministic retry tests                                      |
| QUE-03   | Circuit breaker                                                                                                                          | fault-injection test                                           |
| QUE-04   | Human-intervention wait state                                                                                                            | task parks and resumes without consuming an attempt            |
| RBAC-01  | Sensitive IPC operations require role authorization                                                                                      | role matrix test + native IPC integration                      |
| CAMP-01  | Campaign creates tasks                                                                                                                   | integration test                                               |
| CAMP-02  | Account membership enforced                                                                                                              | negative integration test                                      |
| CAMP-03  | Approval gates block execution                                                                                                           | workflow test                                                  |
| CONT-01  | Content variants                                                                                                                         | local AI fixture/provider test                                 |
| CONT-02  | Media metadata/search                                                                                                                    | indexing test                                                  |
| CONT-03  | Content validation and platform variant selection                                                                                        | deterministic content contract tests                           |
| MEDIA-01 | Media type/size/hash validation and local search                                                                                         | media contract tests                                           |
| MEDIA-02 | Local media file import with streaming SHA-256                                                                                           | native file-hash integration test                              |
| AN-02    | Outcome analytics never aggregate monetary values across currencies                                                                      | native multi-currency analytics test                           |
| AN-03    | Deterministic metric anomaly detection uses only preceding observations and emits descriptive signals without causal/significance claims | anomaly unit tests + deterministic core contract               |
| AN-01    | Campaign analytics remain campaign-scoped                                                                                                | analytics isolation tests                                      |
| AUTO-01  | Enabled external automation rules require confirmation                                                                                   | rule-pack validation tests                                     |
| AUTO-02  | Enabled Rule Pack lifecycle is persisted and bounded                                                                                     | native lifecycle integration test                              |
| UI-01    | Mission Control reflects current workspace operational state without server-side secrets                                                 | desktop smoke/E2E evidence                                     |
| UI-02    | Strategy Studio writes workspace-scoped objectives/audiences/offers/strategies                                                           | native IPC + workspace isolation E2E                           |
| OUT-01   | Opportunity is workspace-scoped and contact/campaign references stay in-workspace                                                        | migration + integrity trigger + negative IPC test              |
| OUT-02   | Opportunity value/currency/probability constraints are enforced                                                                          | validation + SQLite constraint tests                           |
| INS-01   | Insight is workspace-scoped and grounded by at least one source                                                                          | validation + persistence test                                  |
| INS-02   | Insight confidence/value constraints are enforced                                                                                        | validation + SQLite constraint tests                           |
| SIM-01   | Governed execution simulation produces a read-only deterministic plan                                                                    | simulation tests + no-dispatch invariant                       |
| REP-01   | Execution replay reconstructs state without re-running external actions                                                                  | replay validation + deterministic reconstruction               |
| POL-01   | Built-in policy packs materialize explicit workspace-bound safety policies                                                               | policy pack tests + workspace identity validation              |
| MC-01    | Mission Control next actions are workspace-scoped, deterministic, explainable, and read-only                                             | deterministic ranking tests + workspace validation             |
| PLAN-01  | Campaign plan compiler requires a valid strategy and emits dependency-ordered governed work                                              | compiler tests + workspace/strategy validation                 |
| AI-02    | Grounded knowledge context excludes untrusted/expired/cross-workspace evidence and obeys budgets                                         | context tests + workspace/source validation                    |
| GRAPH-01 | Operating graph preserves workspace boundaries and rejects invalid links                                                                 | graph validation tests                                         |
| GRAPH-02 | AI/agent graph context is bounded by depth/node/relation scopes                                                                          | bounded context projection tests                               |
| EXEC-01  | Agent + policy + approval + budget compose into one deterministic execution decision                                                     | decision kernel tests                                          |
| CMD-01   | Command dispatcher enforces registry/surface/scope/approval gates and emits a bounded trace                                              | dispatcher tests + event-spine integration                     |
| EXP-01   | Experiment definition enforces workspace, variant, allocation, and time-window invariants                                                | deterministic core validation tests                            |
| EXP-02   | Variant assignment is deterministic and workspace-scoped                                                                                 | deterministic assignment tests                                 |
| EXP-03   | Experiment summaries ignore cross-workspace observations and compute bounded rates                                                       | workspace-scoped aggregation tests                             |
| EXP-04   | Learning signals do not claim unsupported statistical significance                                                                       | learning-signal tests                                          |
| EXP-05   | Experiment variants bind only to same-workspace campaign content or unique governed message sources                                      | experiment binding tests + campaign contract tests             |
| EXP-06   | Experiment learning produces workspace-scoped descriptive insight/strategy signals without significance claims                           | learning write-back tests + outcome integration tests          |
| EXP-07   | Experiment inference reports bounded uncertainty intervals and allocation drift without significance/causal claims                       | deterministic inference unit tests + bounded interval evidence |
| EVENT-01 | Operational event spine preserves workspace, sequence, parent, trace, redaction, and defensive-copy invariants                           | event-spine tests + native persistence validation              |
| INBOX-01 | Unified conversation model                                                                                                               | connector fixture integration                                  |
| CRM-01   | Conversation-contact linking                                                                                                             | relational integration test                                    |
| SYNC-01  | Offline edits survive restart                                                                                                            | device simulation test                                         |
| SYNC-02  | Concurrent edits converge                                                                                                                | Yjs convergence test                                           |
| BACK-01  | Encrypted backup                                                                                                                         | backup/restore test                                            |
| BACK-02  | Corrupt backup rejected                                                                                                                  | integrity test                                                 |
| BACK-03  | Restore rejects newer/incompatible schema                                                                                                | restore integration test                                       |
| CONN-01  | Capability handshake                                                                                                                     | connector contract test                                        |
| CONN-02  | Unsupported action rejected                                                                                                              | negative connector test                                        |
| CONN-03  | Challenge causes safe stop                                                                                                               | browser fixture test                                           |
| CONN-04  | Native direct execution enforces local daily/circuit safety budgets                                                                      | Rust unit test + source gate                                   |
| CONN-05  | LinkedIn Posts API connector is capability/authorization scoped                                                                          | connector unit fixtures + controlled API test                  |
| WEB-01   | PWA manifest/service worker                                                                                                              | production browser test                                        |
| AI-01    | Local AI Studio chat/content/image analysis stays on local runtime boundary                                                              | desktop client contract tests + runtime smoke                  |
| MOB-01   | Mobile control surface                                                                                                                   | Expo typecheck/build test                                      |
| REL-01   | Reproducible workspace install                                                                                                           | clean CI checkout                                              |
| REL-02   | Signed desktop artifact                                                                                                                  | release pipeline evidence                                      |
| REL-03   | Checksums match distributed artifacts                                                                                                    | release verification                                           |
| LIC-01   | Offline license install/verification/removal                                                                                             | signed token tests + native integration                        |
| OPS-01   | Crash recovery                                                                                                                           | forced termination test                                        |
| OPS-02   | 24h stability                                                                                                                            | soak-test evidence                                             |
| PERF-01  | Startup target                                                                                                                           | measured benchmark                                             |
| PERF-02  | Memory target                                                                                                                            | measured benchmark                                             |
| QA-01    | Unit coverage threshold                                                                                                                  | coverage report                                                |
| QA-02    | Critical E2E paths                                                                                                                       | Playwright report                                              |
| DOC-01   | User guide matches product                                                                                                               | documentation review                                           |
| DOC-02   | Security model documented                                                                                                                | security review                                                |

## Gate rules

- Any `FAIL` in SEC, DATA, QUE, CAMP, CONN, REL, SIM, REP, POL, CMD or EVENT blocks release.
- Any `UNVERIFIED` runtime requirement blocks the claim "production ready".
- Performance targets are measured, never inferred from code size.
- Real-platform tests must be controlled and must not be used to claim immunity from platform enforcement.

### Research Intelligence

| RESEARCH-01 | Research briefs are workspace-scoped and lifecycle-validated | core validation tests + native persistence test |
| RESEARCH-02 | Research findings require workspace-local evidence and bounded confidence/freshness | native integrity E2E + core validation tests |
| RESEARCH-03 | Explicit finding promotion creates workspace-scoped Knowledge with auditable provenance | native publish integration test + audit verification |

### Universal Search

| SEARCH-01 | Universal Search is bounded, deterministic, workspace-scoped, read-only, and excludes secret/session records | core contract tests + native Tauri E2E |
