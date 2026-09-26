# ORBIT Competitive Intelligence — Social Operations

Updated: 2026-09-26.

## Purpose

This is the public-surface competitor watchlist for ORBIT Marketing OS.

It records observable capabilities only. It is a product-planning input, not a
claim about private implementation.

ORBIT keeps its own architecture, data model, policies, runtime, and UX. It
does not copy proprietary source code, private APIs, private data, or protected
assets.

## Watchlist

### RBM Cloud

Observed public capabilities include:

- multi-channel scheduling and publishing;
- unified calendar;
- multi-account management;
- AI templates/content generation;
- analytics/reporting;
- automated publishing;
- team collaboration;
- media library;
- watermark/branding;
- approvals;
- link shortening/tracking;
- RSS auto-posting.

Source: https://rbmcloud.com/

### RBM WhatsApp Cloud

Observed public capabilities include:

- scheduling;
- URL shortening;
- captions and drafts;
- image/video library;
- watermarking;
- multiple accounts;
- preview;
- bulk posts;
- analytics;
- content calendar;
- auto reposting;
- media, links, and text support.

Source: https://rbmwhats.tools/

### RBM Tools

The public anonymous surface currently exposes a login interface. No private
feature set is inferred from it.

Source: https://rbm.tools/

### Buffer

Public product/help material covers:

- multi-channel publishing and scheduling;
- content calendar;
- ideas;
- AI assistance;
- comments/community workflows;
- analytics;
- team collaboration and approvals;
- mobile;
- bulk upload;
- RSS;
- UTM tracking;
- APIs/MCP/agent workflows.

Sources:

- https://buffer.com/
- https://support.buffer.com/

### Metricool

Public product material covers:

- planner/calendar;
- cross-platform publishing;
- recurring posts and templates;
- analytics/reporting;
- unified inbox;
- best-time guidance;
- bulk scheduling;
- content generation;
- SmartLinks;
- hashtag tracking;
- mobile.

Source: https://metricool.com/social-media-management/

### Publer

Public documentation covers:

- bulk scheduling;
- CSV/media-library/RSS workflows;
- AutoSchedule and Recycle;
- multi-account/network operations;
- analytics sourced from social-network APIs.

Sources:

- https://publer.com/
- https://publer.com/help/

## Capability map for ORBIT

The competitor observations translate into these ORBIT workstreams:

### Publishing Workbench

Calendar, multi-channel variants, bulk planning, reusable drafts/templates,
preview, approval, queueing, and execution evidence.

The calendar must remain a read/query surface over the canonical ORBIT queue.
It must not create a second scheduler.

### Brand and Media Intelligence

Workspace-scoped:

- logos;
- watermark rules;
- deterministic media transforms;
- reusable visual presets;
- safe areas;
- platform dimensions;
- provenance and checksums.

### Link Intelligence

Workspace-scoped:

- URL normalization;
- deterministic short identifiers;
- UTM metadata;
- campaign/content association;
- observed click evidence;
- provenance for every metric.

No click metric should be claimed without an evidence source.

### Content Reuse

Governed flow:

source → variant → QA → approval → scheduled reuse

Rules should cover cooldowns, reuse limits, platform exclusions, freshness,
duplicate detection, and configurable human approval.

### Reporting Packs

Generate evidence-backed packs for:

- campaign performance;
- publishing reliability;
- content performance;
- inbox/CRM signals;
- anomalies;
- learning;
- audit history.

Every report should expose its source and time range.

### Competitive Watch

Use ORBIT Research Intelligence as:

source → observation → finding → confidence/freshness → knowledge → strategy

Each observation should retain its source URL and verification date.

## Product principles

- Public competitor claims are observations, not proof of internal implementation.
- Feature parity never overrides ORBIT safety, authorization, or platform
  compliance.
- Local-first ownership remains a core architectural boundary.
- External connectors must remain user-authorized and policy-governed.
- Competitive research must feed product decisions and measurable acceptance
  criteria.

## Current ORBIT delivery sequence

1. Queue-backed Publishing Calendar.
2. Bulk Planner with validation and approval.
3. Brand Kit and deterministic Media Transform.
4. Local Link Registry and measurable-link provenance.
5. Governed Content Reuse Engine.
6. Evidence-backed Reporting Packs.
7. Automated competitor observation refresh through the existing Research layer,
   subject to source availability and compliance.
