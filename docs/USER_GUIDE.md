# ORBIT Marketing OS — User Guide

Local-first social operations console: campaigns, unified inbox, CRM, content studio, automation and approvals in one place. This guide matches the shipped v2.4.1 product surface (12-tab workspace).

Related docs: [Architecture](PRODUCT_ARCHITECTURE_V2.md) · [Security model](SECURITY_MODEL.md) · [README](../README.md) (install/scripts)

---

## 1. Install and run

Prerequisites: Node.js 20+ (22 recommended), npm 10+.

```bash
npm install
npm install --prefix packages/core
cp .env.example .env   # set GEMINI_API_KEY for AI features
npm run dev            # http://localhost:3000
```

- `GEMINI_API_KEY` is **optional at boot**: the app starts without it and logs a warning; AI panels (chatbot, vision, content assist) report the missing key instead of failing the console.
- Production mode: `npm run build && npm start` — the same server serves the built console and the API.
- Desktop shell: `npm run tauri:build` produces the Tauri desktop build (see §11).

## 2. The workspace at a glance

The console header shows the brand (`SOCIAL AUTOMATION OS`), environment/health chips, and a footer status. The left rail lists the 12 workspace tabs. Each tab is a self-contained console view; navigation never loses the app shell.

| # | Tab | What it is for |
|---|-----|----------------|
| 1 | المساعد الذكي (AI Chatbot) | Conversational assistant over your local data and workflows |
| 2 | استوديو التحليل البصري (Vision AI) | Image analysis studio (labels, quality checks) |
| 3 | استوديو المحتوى و DAM | Content creation, variants, and media asset library |
| 4 | محرك الأتمتة (Stealth Engine) | Deterministic automation queue with policy gates |
| 5 | إدارة وجدولة الحملات | Multi-platform campaign CRUD, scheduling, membership |
| 6 | صندوق المحادثات الموحد | Unified inbox across conversations → CRM handoff |
| 7 | إدارة علاقات العملاء (CRM) | Pipeline stages, contacts, deal movement |
| 8 | درع الحماية ومنع الحظر (Anti-Ban) | Rate/risk policy shield for automation actions |
| 9 | حسابات ومنصات | Connected accounts and platform credentials (vaulted) |
| 10 | مزامنة P2P محلية (CRDTs) | Offline-first sync documents and encrypted snapshots |
| 11 | إدارة الترخيص المحلي | Local license activation, entitlements, tamper checks |
| 12 | بنية النظام Monorepo | Live architecture map of packages/planes |

## 3. Campaigns and scheduling (Tab 5)

- Create a campaign, pick a target platform capability, set a schedule window.
- Campaign membership tracks per-target state; transitions are validated (no illegal state jumps).
- Nothing is published directly from this screen: actions are queued into the automation engine, which evaluates policy first (see §5).

## 4. Inbox and CRM (Tabs 6–7)

- **Unified inbox** merges conversations into one stream with per-thread state (open, pending, resolved).
- Assign or hand a thread to the CRM: the contact appears in the pipeline with its history.
- **CRM pipeline** shows deals by stage; moving a stage is an explicit action and is recorded.
- Exports/imports are treated as data operations: malformed files are rejected, never partially applied.

## 5. Automation engine (Tab 4)

The engine is the only component that executes platform actions:

1. A task enters the queue with a deterministic lifecycle: `queued → running → completed`, plus `retrying` while bounded backoff is in play, and terminal `failed` / `cancelled` / `blocked`.
2. **Policy evaluation runs first** — Anti-Ban rules, account health, and capability limits can hold (`blocked`) or kill a task.
3. Retries are bounded with backoff; once `maxRetries` is exhausted the task settles as `failed` — it is never retried forever.
4. The circuit breaker opens on repeated platform errors and stops new work until cooldown.
5. Every decision is appended to the audit chain (tamper-evident hash links).

Queue state persists: a restart resumes from disk, it does not drop work.

## 6. Content studio and media (Tab 3)

- Generate and store **content variants** (same brief, multiple framings). Content approval status flows `draft → pending → approved | rejected | changes_requested`.
- Approval is a real gate enforced by the core: publishing checks require `approved` (or `draft` when approval is not required for that path) — `pending`, `rejected` and `changes_requested` content is blocked from publishing.
- The **media library (DAM)** indexes local assets with checksums; duplicate detection and integrity re-checks run on demand.
- Vision AI (Tab 2) annotates images for reuse in variants.

## 7. Accounts, Anti-Ban, and safety (Tabs 8–9)

- Platform credentials are stored in the **encrypted secret vault** — they never appear in analytics events or logs (redaction is enforced in code and covered by tests).
- Anti-Ban defines rate and risk ceilings per account/platform; the policy engine consumes these limits before any automation run.
- If an account is flagged or a challenge state is detected, the runner **stops safely** and requests intervention instead of forcing through — this is by design.

## 8. Sync, backup, and licensing (Tabs 10–12)

- **CRDT sync**: collaborative documents merge offline-first; conflicts converge deterministically. Snapshots are encrypted at rest and verified on load (corrupted snapshots are rejected, not repaired silently).
- **Backup**: encrypted backups include integrity metadata; restore verifies before replacing live state.
- **Licensing**: activation is local — entitlements are validated against the license vault, with tamper detection. No telemetry is sent.
- **Architecture tab** visualizes the monorepo planes (web console, core domain, connectors) for operators.

## 9. Offline and PWA behavior

- The console is installable (manifest + icons) and works offline after one normal visit: static assets are precached by the service worker, and the app shell renders without a network.
- Live API data requires the local server; when it is unreachable, views fall back to cached/local state rather than breaking.
- CRDT sync documents queue changes while offline and converge when peers reconnect.

## 10. Data and security model (summary)

1. Credentials never enter analytics events.
2. The renderer never receives unrestricted filesystem/database capabilities.
3. No automation task executes before policy evaluation.
4. Every task has a deterministic lifecycle and terminal state.
5. Connectors expose only capabilities they implement.
6. Unknown/changing UI states fail closed.
7. Sync transports carry encrypted application updates, not raw credentials.
8. Backup restore verifies integrity before replacing active state.
9. Releases are immutable, versioned and checksummed.

Full details: [SECURITY_MODEL.md](SECURITY_MODEL.md).

## 11. Desktop shell (Tauri)

- The Tauri 2 desktop shell (`src-tauri/`) wraps the same console with **deny-by-default capability isolation**: the renderer gets exactly `core:default` (window lifecycle), no filesystem/shell/network plugin access, and a strict CSP.
- Build: `npm run tauri:build` (release build embeds the production `dist/`).
- Expectations: automation and data behavior are identical to the browser console; the shell adds OS integration, not new permissions.

## 12. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Startup warning: API key not set | `GEMINI_API_KEY` missing | Copy `.env.example` → `.env`, set the key, restart |
| Port already in use | Another process on :3000 | Stop it, or set `PORT=<free port>` |
| AI panels error | Key invalid/expired | Regenerate the key, update `.env` |
| App shows stale data after restore | Restore finished but tab cached | Reload the console (restore is verified before it replaces state) |
| Offline: no live updates | Server not running | Start `npm start`; offline view stays read-only until then |
| Desktop build fails on a clean machine | Missing VS Build Tools / Rust toolchain | Install VS Build Tools (vcvars64) + rustup `stable-x86_64-pc-windows-msvc`, then `npm run tauri:build` |
| Challenge/2FA detected in automation | Platform intervention required | Expected: the runner halts safely and flags the account for manual action |

## 13. FAQ

**Is anything sent to the cloud?** No. The system is local-first: data, sync, backup and licensing are processed on your machine; only the optional AI provider calls leave the box, and they never include credentials.

**What happens if I kill the process mid-task?** On restart the queue recovers from disk; in-flight tasks are re-queued or marked failed per their deterministic lifecycle — no duplicate silent execution.

**Can I use it without AI features?** Yes — everything except the AI-assisted panels works without `GEMINI_API_KEY`.

**Where are my files?** Application state lives with the server working directory (database, encrypted snapshots/backups); media assets stay where you imported them and are indexed by checksum.
