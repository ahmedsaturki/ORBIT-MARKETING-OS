# ORBIT Universal Search

Universal Search is the read-only discovery layer of the ORBIT operating graph.

## Contract

Search is workspace-scoped and reads the canonical local SQLite runtime. It does not mutate state, execute connectors, create tasks, or bypass approval or policy boundaries.

The current native search surface covers campaigns, content, contacts, conversations, opportunities, work items, strategy, knowledge, agents, policies, experiments, research briefs, and research findings.

Results are bounded to 50 items, deterministically ordered, and expose only compact discovery metadata. Vault records, session payloads, passwords, tokens, and API keys are never searchable.

Queries are trimmed, limited to 200 characters, reject control characters, and use parameter-bound SQL with wildcard escaping.

## UX

Desktop exposes Universal Search near the top of Mission Control. Ctrl+K / Cmd+K focuses the search field, Enter executes the query, and Escape clears the current search.

Universal Search is intentionally a discovery layer rather than a second command or execution system. Future command-palette actions must invoke the canonical governed Command Registry/Dispatcher rather than piggybacking on search.

## Research integration

Research briefs and findings are first-class searchable entities. A finding may also be promoted explicitly into Knowledge; search then exposes either the original research record or its governed Knowledge record without changing source provenance.

## Acceptance

SEARCH-01 requires core contract tests plus native Tauri E2E evidence for bounded results, multi-entity discovery, workspace isolation, and secret exclusion.
