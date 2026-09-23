# ORBIT Competitive Research — 2026

## Purpose

This document converts current category patterns into product requirements for ORBIT. It is not a feature-copying exercise; it identifies the operational primitives that leading products have converged on and the gaps ORBIT can exploit through a local-first architecture.

## Market patterns observed

### Hootsuite
- Unified publishing, engagement, listening, analytics and governance.
- Approval bottleneck management and external approval tracking.
- Cross-network post comparison and broad reporting.
- AI is moving from assistant features toward an orchestration layer.

### Sprout Social
- Unified Smart Inbox with conversation history, contact views, routing and collision detection.
- Social listening as a business-intelligence layer, not just keyword search.
- Cross-network analytics and customer-care workflows.

### Buffer
- Simplicity remains a competitive advantage.
- Unified community/comment management.
- Team permissions, approval workflows, notes and shared calendars.
- AI observations and platform-specific publishing assistance.

### Metricool
- Planner + analytics + reporting + inbox in one workspace.
- Automated reports and recurring content lists.
- Best-time optimization, campaign dashboards, smart links and workflow automation.
- Strong free-entry positioning.

### Planable
- Collaboration is attached directly to the content object.
- Visual feed/calendar/list views.
- Contextual feedback and explicit approval states.
- Supports marketing content beyond social posts.

### Later
- Visual planning is a major differentiator for Instagram/TikTok-heavy teams.
- Visual calendar, auto-publishing, analytics and link-in-bio are tightly connected.
- Cross-platform analytics should focus on business outcomes, not vanity metrics.

### SocialPilot
- Agency-oriented bulk scheduling.
- Large scheduled queues, content library, approvals and client collaboration.
- Analytics and multi-account management are central to the product.

## ORBIT opportunity

ORBIT should not compete by becoming another cloud dashboard with a larger connector count. The differentiation is:

1. **Local-first control plane:** operational data and secrets remain on-device by default.
2. **Evidence-first automation:** every automated operation has a policy decision, execution result and audit trail.
3. **Human-in-the-loop safety:** authentication challenges, uncertain UI states and policy-sensitive actions stop for user review.
4. **Portable content intelligence:** local AI can transform one content brief into platform-specific variants without requiring a cloud AI account.
5. **Operational CRM:** conversations, contacts, campaigns, content and outcomes share one local data model.
6. **Resilient offline operation:** drafts, approvals, queues, analytics snapshots and backups continue offline.
7. **Team governance without centralizing secrets:** approvals, permissions and audit records can synchronize while credentials remain device-local.
8. **Arabic-first UX:** full RTL and Arabic copy quality are first-class rather than localization afterthoughts.

## Features ORBIT must match as table stakes

- Visual content calendar
- Drafts and approval workflow
- Multi-account/channel management
- Unified inbox
- Quick replies/templates
- Content/media library
- Campaign tagging and analytics
- Cross-network performance comparison
- Team roles and permissions
- Notifications and failure routing
- Mobile monitoring
- Reporting/export
- AI content assistance

## Features ORBIT should exceed competitors on

- Local encrypted vault
- Offline-first queue
- Cryptographic audit chain
- Local AI provider abstraction
- Rule-pack versioning with rollback
- Connector capability discovery
- Policy engine before execution
- Per-account safety budgets
- Portable encrypted backup
- Reproducible self-host/local runtime
- Arabic/RTL as a product default

## Product principle

Do not maximize the number of features. Maximize the number of complete workflows that a real operator can finish without leaving ORBIT.
