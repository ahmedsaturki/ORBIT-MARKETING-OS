# ORBIT Competitive Intelligence — Social Operations

Updated: 2026-09-26.

## Purpose

This document is the canonical public-surface competitor watchlist for ORBIT Marketing OS. It records observable product capabilities, not private implementation details, and converts competitor observations into buildable ORBIT capability requirements.

The objective is not to copy another product. ORBIT should own its implementation, data model, policy layer, runtime, and user experience while learning from capabilities that users already expect in modern marketing operations software.

## Current watchlist

| Surface | Observable public positioning / capabilities | ORBIT build implication |
| --- | --- | --- |
| RBM Cloud | Multi-channel scheduling/publishing, unified calendar, multi-account management, AI templates/content generation, analytics/reporting, automated publishing, team collaboration, media library, watermark/branding, approvals, link shortening/tracking, and RSS-driven auto-posting are publicly presented. | ORBIT should make its Content → Approval → Queue path competitive at the workflow level: calendar, reusable media, brand controls, link intelligence, reporting, and governed automation. |
| RBM WhatsApp Cloud | Publicly presents scheduling, URL shortening, saved captions/drafts, image/video library, watermarking, multiple-account management, preview, bulk posts, analytics, content calendar, auto reposting, and support for media/links/text. | ORBIT should treat bulk planning, reusable content, previews, safe reposting, and measurable links as first-class operations rather than isolated utilities. |
| RBM Tools | Publicly exposed surface is currently an account/login interface; public anonymous feature detail is limited. | Track separately; do not infer private capabilities from the login surface. |
| Buffer | Publicly presents publishing/scheduling across many channels, a content calendar, ideas, AI assistance, community/comment workflows, analytics, team collaboration/approval, mobile, and AI-assisted workflows through MCP/API/agents. | ORBIT should keep its governed command/event spine and local ownership while exposing equivalent operator ergonomics where they fit the local-first model. |
| Metricool | Publicly presents planner/calendar, cross-platform publishing, automated recurring posts/templates, analytics/reporting, unified inbox, best-time insights, bulk scheduling, content generator, SmartLinks, hashtag tracking, and mobile apps. | ORBIT should connect planning, execution, inbox, analytics, and learning into one governed loop and add native link intelligence plus reusable publishing recipes. |
| Publer | Public documentation describes analytics sourced from social-network APIs, aggregate and per-account views, filtering, and reporting; its broader product also targets publishing and scheduling workflows. | ORBIT should preserve an explicit “source of truth” distinction between local operational evidence and third-party platform analytics, with provenance on every metric. |

## Capability matrix

The matrix is deliberately capability-oriented so it can drive implementation and acceptance criteria.

| Capability | RBM | Buffer | Metricool | Publer | ORBIT target |
| --- | --- | --- | --- | --- | --- |
| Multi-channel scheduling | Yes | Yes | Yes | Yes | Core governed queue + connector-specific scheduling |
| Unified calendar | Yes | Yes | Yes | Product capability | Native Content Calendar |
| Bulk publishing/planning | Yes | Yes | Yes | Product capability | Bulk Planner with validation and approval |
| Drafts/content ideas | Yes | Yes | Yes | Product capability | Ideas → Briefs → Variants → Approval |
| AI content generation | Yes | Yes | Yes | Product capability | Local-first AI with bounded roles |
| Team collaboration | Yes | Yes | Yes | Product capability | Workspace/RBAC + approvals + audit |
| Approval workflow | Yes | Yes | Yes | Product capability | Governed approval and command dispatch |
| Media library | Yes | Product capability | Product capability | Product capability | Native indexed local media catalog |
| Watermark / brand controls | Yes | Varies by workflow | Product capability varies | Product capability | Brand kit + deterministic media transform |
| URL shortener / link tracking | Yes | Yes | SmartLinks | Analytics/link features | Local link registry + UTM/provenance + click evidence |
| RSS / feed automation | Yes | Yes | Automation/content lists | Product capability | Governed feed ingestion with policy + approval |
| Auto repost / recurring reuse | Yes | Product capability | Yes | Product capability | Policy-governed repurpose/reuse |
| Unified inbox / community | Product surface | Yes | Yes | Product capability | CRM + Inbox + human intervention states |
| Analytics / reporting | Yes | Yes | Yes | Yes | Workspace-scoped analytics + evidence + learning |
| Mobile control | Web | Yes | Yes | Yes | Expo control/monitoring surface |
| API / agent control | Not assumed from public surface | Publicly presented | Not central to this comparison | API/product integrations vary | Canonical Command Registry + MCP/CLI |
| Local-first private source of truth | Not publicly established | No | No | No | Architectural law of ORBIT |
| Policy-gated execution | Not publicly established | Not the central public positioning | Not the central public positioning | Not the central public positioning | Core ORBIT differentiator |
| Encrypted local vault/session boundary | Not publicly established | Not the product thesis | Not the product thesis | Not the product thesis | Core ORBIT security contract |

## ORBIT build priorities derived from the watchlist

### Publishing Workbench

A single governed workspace should support:
1. calendar planning;
2. multi-channel variants;
3. bulk import;
4. drafts and reusable templates;
5. preview;
6. approval;
7. deterministic enqueueing;
8. execution evidence.

The planner must remain an operator over ORBIT's canonical queue, not become a second scheduler.

### Brand Kit and Media Intelligence

Add a workspace-scoped brand layer for:
- logos;
- watermark rules;
- default media transforms;
- reusable visual presets;
- content-safe areas;
- platform-specific dimensions;
- asset provenance and checksum.

Transforms must be deterministic and auditable.

### Link Intelligence

Add a local link registry that can:
- normalize URLs;
- create deterministic short IDs;
- attach UTM/source metadata;
- associate links with campaigns/content/variants;
- record observed click evidence when a supported source provides it;
- keep link analytics workspace-scoped.

Do not claim click analytics when the evidence source does not exist.

### Content Reuse Engine

Treat republishing as a governed transformation:
`source content → variant generation → QA → approval → scheduled reuse`

Rules should support:
- cooldown windows;
- maximum reuse count;
- platform exclusions;
- content freshness;
- duplicate-content detection;
- human approval where configured.

### Reporting Packs

Generate deterministic report packs from workspace-scoped evidence:
- campaign summary;
- publishing reliability;
- content performance;
- inbox/CRM conversion signals;
- anomalies;
- learning signals;
- audit trail.

Every report should expose provenance and time range.

### Competitive Watch

The Research Intelligence layer should support competitor observations as evidence-backed records:
`source → observation → finding → confidence/freshness → knowledge → strategy`

The current watchlist includes the RBM surfaces supplied in the project brief plus Buffer, Metricool, and Publer. New competitors should be added only from observable sources, with the source URL and verification date.

## Evidence policy

- Public marketing claims are observations, not proof of internal implementation.
- A competitor capability becomes an ORBIT requirement only after its user value and governance implications are defined.
- ORBIT must not copy proprietary source code, private APIs, private data, branding, or protected assets.
- Feature parity does not override ORBIT's local-first, user-authorized, policy-governed execution boundary.
- External connector support must remain compliant with each platform's current terms and APIs.

## Public sources

- https://rbmcloud.com/
- https://rbm.tools/
- https://rbmwhats.tools/
- https://buffer.com/
- https://metricool.com/social-media-management/
- https://publer.com/help/en/article/1a9vkgm/
