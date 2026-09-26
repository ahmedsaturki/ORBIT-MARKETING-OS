# ORBIT Universal Search

Universal Search is the read-only discovery layer for the ORBIT operating graph.

## Contract

Search is workspace-scoped and reads the canonical local SQLite runtime. It does not mutate state, execute connectors, create tasks, or bypass approval/policy boundaries.

The current native search surface covers campaigns, content, contacts, conversations, opportunities, work items, strategy, knowledge, agents, policies, and experiments.

Results are bounded to 50 items, deterministically ordered, and expose only compact discovery metadata. Vault records, session payloads, passwords, tokens, and API keys are never searchable.

## UX

Desktop exposes Universal Search near the top of Mission Control. Ctrl+K / Cmd+K focuses the search field, Enter executes the query, and Escape clears the current search.

Universal Search is intentionally a discovery layer rather than a second command/execution system. A future command palette can invoke governed commands through the canonical Command Registry/Dispatcher, while search itself remains read-only.

## Architecture

The core package owns the shared result contract and deterministic ordering. The Tauri runtime owns the actual SQLite query and applies the active workspace authorization boundary before reading data.

The search query is parameter-bound. Wildcard characters are escaped so user input cannot silently broaden the SQL pattern.

## Acceptance

SEARCH-01 is satisfied by a native Tauri E2E that searches across multiple entity types and verifies workspace isolation plus a bounded result set.
