# INTELLI PLATFORM — DEVELOPMENT TRACKER

> **SINGLE SOURCE OF TRUTH** for parallel development across all Intelli products.
> Every developer and every Claude session MUST read this document before starting work.
> Last updated: 2026-03-23

---

## TABLE OF CONTENTS

1. [How to Use This Document](#how-to-use-this-document)
2. [For Claude Sessions](#for-claude-sessions)
3. [Project Overview](#project-overview)
4. [Tech Stack](#tech-stack)
5. [Folder Structure](#folder-structure)
6. [Git Workflow](#git-workflow)
7. [Status Legend](#status-legend)
8. [Feature Registry](#feature-registry)
9. [Conflict Prevention Rules](#conflict-prevention-rules)

---

## HOW TO USE THIS DOCUMENT

### For Developers (Humans)

1. **Before starting work**: `git pull origin main` to get the latest version of this file
2. **Pick a feature**: Find a feature with status `OPEN` in the Feature Registry below
3. **Claim it**: Change its status to `BUILDING` and add your name as Assignee. **Push this change immediately.**
4. **Create a branch**: Use the branch name specified in the feature line (or create one following the naming convention)
5. **Build the feature**: Work on your branch
6. **Mark complete**: Change status to `BUILT`, push this file update, then create a PR to merge your branch into `main`
7. **After merge**: Ensure this file on `main` reflects `BUILT` for your feature

### CRITICAL RULES

- **ALWAYS pull before picking a feature** — someone else may have claimed it
- **ALWAYS push immediately after claiming** — this prevents two people working on the same feature
- **NEVER work on a feature marked `BUILDING`** — someone else is on it
- **NEVER work on a feature marked `BLOCKED`** — its dependencies aren't ready
- **ALWAYS push this file after completing a feature** — others need to see the updated status
- **ONE feature per branch** — keeps PRs small and reviewable

---

## FOR CLAUDE SESSIONS

> **Claude: Read this entire section before doing anything.**

You are being used by a developer to build a feature of the Intelli Platform. Multiple developers are using separate Claude sessions simultaneously to build different features in parallel.

### What You Must Do

1. **Read this entire document first** — understand what's built, what's in progress, and what's available
2. **Check the Feature Registry** — only work on features with status `OPEN`
3. **Check dependencies** — if a feature has `Deps: [X, Y]`, verify X and Y are `BUILT` before proceeding
4. **Follow the folder structure** — place files exactly where the Folder Structure section specifies
5. **Follow the tech stack** — use only the technologies listed in Tech Stack
6. **Update this file** when you start (change to `BUILDING`) and when you finish (change to `BUILT`)
7. **Remind the developer to push** after every status change

### What You Must NOT Do

- Do NOT work on features marked `BUILDING`, `BUILT`, or `BLOCKED`
- Do NOT create folders or files outside the defined folder structure
- Do NOT install packages not listed in the tech stack without developer approval
- Do NOT modify code belonging to another feature's scope
- Do NOT assume a dependency is built — check its status in this document

### How to Handle Multiple Features in One Chat

If a developer asks you to build multiple features in one session:
1. Build them ONE AT A TIME
2. After each feature: update this file → remind developer to push → then start the next
3. Never start feature B while feature A's status update hasn't been pushed

### Import Conventions

When importing from other modules, use the folder structure paths. If a dependency module isn't `BUILT` yet, create an interface/contract file that defines what you expect from it, and note this in the feature's `Notes` field.

---

## PROJECT OVERVIEW

**Intelli Platform** is Fidelis Digital's suite of 5 AI-native enterprise products:

| Product | Description | Target Users |
|---------|-------------|--------------|
| **Intelli Platform** | Shared core services (auth, AI, data, notifications) | All products |
| **Intelli Depot™** | AI-powered warehouse & logistics management | Warehouse Ops |
| **Intelli Cafe™** | Employee engagement & internal social platform | HR, All Employees |
| **Intelli Recruit™** | End-to-end talent acquisition & recruitment | Recruiters, HR |
| **Intelli Stream™** | CFO intelligence & financial analytics suite | Finance, Treasury |

### Architecture (7-Layer Model)

```
Layer 7: AI Orchestration Brain          ← Multi-agent, LLM management
Layer 6: Common Platform Services        ← Auth, APIs, Notifications, Workflows
Layer 5: Data Infrastructure             ← Data warehouse, Vector DB, ETL
Layer 4: Integration Layer               ← ERP, CRM, API connectors
Layer 3: Command/Operations Layer        ← Product-specific business logic
Layer 2: Module-Specific Layers          ← Product features
Layer 1: Vision/User Experience          ← UI, Dashboards, Mobile
```

**Build order**: Layers 7 → 6 → 5 → 4 → then product-specific features (Layers 3-1) can be built in parallel.

---

## TECH STACK

### Backend
- **Language**: Python 3.11+
- **Framework**: FastAPI
- **ORM**: SQLAlchemy 2.0+ with Alembic migrations
- **Task Queue**: Celery with Redis
- **Caching**: Redis

### Frontend
- **Framework**: React 18+ with TypeScript
- **State Management**: Zustand
- **UI Library**: Tailwind CSS + shadcn/ui
- **API Client**: Axios with React Query

### AI / ML
- **LLM Orchestration**: LangChain / LangGraph
- **Vector Database**: Pinecone or Weaviate
- **Embeddings**: OpenAI Ada or Cohere
- **Computer Vision** (Depot): YOLO v8 + OpenCV
- **NLP**: spaCy, Hugging Face Transformers

### Infrastructure
- **Database**: PostgreSQL 15+
- **Search**: Elasticsearch
- **Storage**: S3-compatible (MinIO for local dev)
- **Messaging**: RabbitMQ or Redis Streams
- **Containerization**: Docker + Docker Compose

### Testing
- **Backend**: pytest + pytest-cov
- **Frontend**: Vitest + React Testing Library
- **E2E**: Playwright

---

## FOLDER STRUCTURE

All developers and Claude sessions MUST follow this structure exactly:

```
intelli/
├── DEVELOPMENT_TRACKER.md          ← THIS FILE
├── docker-compose.yml
├── .env.example
│
├── backend/
│   ├── app/
│   │   ├── main.py                 ← FastAPI app entry point
│   │   ├── config.py               ← Settings & env vars
│   │   ├── database.py             ← DB connection & session
│   │   │
│   │   ├── core/                   ← Layer 7 & 6: Shared platform services
│   │   │   ├── auth/               ← Authentication & authorization
│   │   │   ├── ai_orchestration/   ← AI Brain, LLM routing, agents
│   │   │   ├── notifications/      ← Email, WhatsApp, SMS, Slack, Teams
│   │   │   ├── workflows/          ← Workflow automation engine
│   │   │   ├── analytics/          ← Predictive analytics & simulation
│   │   │   ├── data_infra/         ← ETL, data fabric, vector DB
│   │   │   ├── integrations/       ← ERP, CRM, API connectors
│   │   │   ├── observability/      ← Logging, monitoring, tracing
│   │   │   └── gateway/            ← API gateway & routing
│   │   │
│   │   ├── depot/                  ← Intelli Depot product
│   │   │   ├── vision/             ← Computer vision (IntelliVision)
│   │   │   ├── inventory/          ← Inventory management
│   │   │   ├── shipment/           ← Shipment tracking
│   │   │   ├── labor/              ← Labor & workforce
│   │   │   └── gate/               ← Gate control & LPR
│   │   │
│   │   ├── cafe/                   ← Intelli Cafe product
│   │   │   ├── feed/               ← Posts, comments, reactions
│   │   │   ├── engagement/         ← Recognition, rewards, surveys
│   │   │   ├── townhall/           ← Virtual townhall & summaries
│   │   │   ├── feedback/           ← Feedback submission & tracking
│   │   │   └── moderation/         ← Content moderation
│   │   │
│   │   ├── recruit/                ← Intelli Recruit product
│   │   │   ├── jobs/               ← Job intelligence & JD generation
│   │   │   ├── sourcing/           ← Talent sourcing & pool
│   │   │   ├── outreach/           ← Campaign engine
│   │   │   ├── interviews/         ← Scheduling & management
│   │   │   └── assessment/         ← Skills assessment & scoring
│   │   │
│   │   ├── stream/                 ← Intelli Stream product
│   │   │   ├── macropulse/         ← Market intelligence
│   │   │   ├── competelens/        ← Competitive intelligence
│   │   │   ├── cashflow/           ← Cash flow intelligence
│   │   │   ├── variance/           ← Variance analysis
│   │   │   ├── riskradar/          ← Risk scoring & compliance
│   │   │   └── financial_integrations/ ← SAP, Oracle, CRM sync
│   │   │
│   │   └── shared/                 ← Shared utilities & models
│   │       ├── models/             ← SQLAlchemy base models
│   │       ├── schemas/            ← Pydantic schemas
│   │       ├── utils/              ← Helpers & utilities
│   │       └── middleware/         ← Custom middleware
│   │
│   ├── tests/                      ← Mirror of app/ structure
│   ├── alembic/                    ← Database migrations
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── app/                    ← Next.js / React app root
│   │   ├── components/
│   │   │   ├── common/             ← Shared UI components
│   │   │   ├── depot/
│   │   │   ├── cafe/
│   │   │   ├── recruit/
│   │   │   └── stream/
│   │   ├── hooks/                  ← Custom React hooks
│   │   ├── stores/                 ← Zustand stores
│   │   ├── services/               ← API client functions
│   │   ├── types/                  ← TypeScript types
│   │   └── utils/                  ← Frontend utilities
│   ├── public/
│   └── package.json
│
└── docs/                           ← Project documentation
    ├── api/                        ← API documentation
    └── architecture/               ← Architecture decision records
```

### File Naming Conventions

- **Python files**: `snake_case.py`
- **React components**: `PascalCase.tsx`
- **Hooks**: `useCamelCase.ts`
- **Tests**: `test_<module_name>.py` (backend), `<Component>.test.tsx` (frontend)
- **Each module folder** must have an `__init__.py` (backend) or `index.ts` (frontend)

---

## GIT WORKFLOW

### Branch Naming

```
feature/<product>/<feature-short-name>
```

Examples:
- `feature/core/auth-rbac`
- `feature/depot/bag-detection`
- `feature/cafe/post-feed`
- `feature/recruit/jd-generation`
- `feature/stream/macropulse-fx`

### Workflow Steps

```
1. git pull origin main
2. Read DEVELOPMENT_TRACKER.md — find an OPEN feature
3. Update feature status to BUILDING with your name
4. git add DEVELOPMENT_TRACKER.md
5. git commit -m "claim: <feature-name> — @<your-name>"
6. git push origin main
7. git checkout -b feature/<product>/<feature-name>
8. === BUILD THE FEATURE ===
9. git add <your files>
10. git commit -m "feat(<product>): <description>"
11. Update feature status to BUILT in DEVELOPMENT_TRACKER.md
12. git add DEVELOPMENT_TRACKER.md
13. git commit -m "tracker: mark <feature-name> as BUILT"
14. git push origin feature/<product>/<feature-name>
15. Create PR to merge into main
```

### Commit Message Format

```
<type>(<scope>): <description>

Types: feat, fix, refactor, test, docs, chore
Scope: core, depot, cafe, recruit, stream, shared
```

---

## STATUS LEGEND

| Status | Meaning | Who Can Change It |
|--------|---------|-------------------|
| `NOT_BUILT` | Not started, may have unmet dependencies | Anyone (to OPEN when deps met) |
| `OPEN` | Ready to be picked up, all dependencies are BUILT | Anyone (to BUILDING) |
| `BUILDING` | Someone is actively working on this | Only the assignee (to BUILT) |
| `BUILT` | Complete, tested, merged to main | No one (final state) |
| `BLOCKED` | Cannot start — dependencies not yet BUILT | Auto (when deps become BUILT → OPEN) |

### Feature Line Format

```
- [STATUS] **Feature Name** | Assignee: @name | Branch: feature/x/y | Deps: [Feature A, Feature B] | Notes: ...
```

When a feature has no assignee or branch yet:
```
- [OPEN] **Feature Name** | Assignee: — | Branch: — | Deps: [None] | Notes: ...
```

---

## FEATURE REGISTRY

> **IMPORTANT**: Before claiming a feature, always `git pull` and re-read this section.
> Features are listed in recommended build order within each section.
> Features with `Deps: [None]` can be started immediately if status is `OPEN`.

---

### LAYER 7: AI ORCHESTRATION (Common Core)

These are foundational AI services used by ALL products. Build these first.

- [BUILT] **AI-7.1: LLM Orchestration Engine** | Assignee: @dev-1 | Branch: feature/core/llm-orchestration | Deps: [None] | Notes: Multi-model routing (OpenAI, Anthropic, local models), fallback logic, token management, cost tracking. Location: `backend/app/core/ai_orchestration/llm_engine.py`
- [BUILT] **AI-7.2: Multi-Agent Framework** | Assignee: @claude-session-2 | Branch: feature/core/multi-agent-framework | Deps: [AI-7.1] | Notes: Agent lifecycle management, task delegation, inter-agent communication. Location: `backend/app/core/ai_orchestration/agent_framework.py`
- [OPEN] **AI-7.3: RAG Framework** | Assignee: — | Branch: — | Deps: [AI-7.1, DATA-5.2] | Notes: Retrieval-Augmented Generation with vector DB integration, chunking, embedding pipeline. Location: `backend/app/core/ai_orchestration/rag/`
- [BUILT] **AI-7.4: Prompt Management System** | Assignee: @claude-session-3 | Branch: feature/core/prompt-management | Deps: [AI-7.1] | Notes: Prompt templates, versioning, A/B testing for prompts. Location: `backend/app/core/ai_orchestration/prompts/`
- [BUILT] **AI-7.5: Explainability Engine (XAI)** | Assignee: @Suraj | Branch: feature/core/explainability | Deps: [AI-7.1] | Notes: Transparent AI reasoning, decision audit trails, confidence scoring. Location: `backend/app/core/ai_orchestration/explainability.py`

---

### LAYER 6: COMMON PLATFORM SERVICES

Core services shared across all 5 products.

#### Authentication & Identity

- [BUILT] **AUTH-6.1: Authentication System** | Assignee: @claude-session-2 | Branch: feature/core/auth-system | Deps: [None] | Notes: JWT-based auth, login/logout, password reset, session management. Location: `backend/app/core/auth/authentication.py`
- [BUILT] **AUTH-6.2: RBAC (Role-Based Access Control)** | Assignee: @Suraj | Branch: feature/core/rbac | Deps: [AUTH-6.1] | Notes: Roles, permissions, policy engine, multi-tenant support. Location: `backend/app/core/auth/rbac.py`
- [OPEN] **AUTH-6.3: SSO Integration** | Assignee: — | Branch: — | Deps: [AUTH-6.1] | Notes: SAML 2.0, OAuth 2.0, Azure AD, Google Workspace. Location: `backend/app/core/auth/sso.py`
- [OPEN] **AUTH-6.4: Multi-Tenant & White Labeling** | Assignee: — | Branch: — | Deps: [AUTH-6.1, AUTH-6.2] | Notes: Tenant isolation, custom branding per org, subdomain routing. Location: `backend/app/core/auth/tenancy.py`

#### API Gateway

- [OPEN] **GW-6.5: Unified API Gateway** | Assignee: — | Branch: — | Deps: [AUTH-6.1] | Notes: Rate limiting, request routing, API versioning, request/response logging. Location: `backend/app/core/gateway/`
- [OPEN] **GW-6.6: API Documentation & SDK** | Assignee: — | Branch: — | Deps: [GW-6.5] | Notes: Auto-generated OpenAPI docs, client SDK generation. Location: `backend/app/core/gateway/docs.py`

#### Notifications

- [OPEN] **NOTIF-6.7: Notification Engine Core** | Assignee: — | Branch: — | Deps: [None] | Notes: Template system, delivery queue, retry logic, delivery tracking. Location: `backend/app/core/notifications/engine.py`
- [OPEN] **NOTIF-6.8: Email Channel** | Assignee: — | Branch: — | Deps: [NOTIF-6.7] | Notes: SMTP/SendGrid/SES integration, HTML templates, attachments. Location: `backend/app/core/notifications/channels/email.py`
- [OPEN] **NOTIF-6.9: WhatsApp Channel** | Assignee: — | Branch: — | Deps: [NOTIF-6.7] | Notes: WhatsApp Business API, message templates, media support. Location: `backend/app/core/notifications/channels/whatsapp.py`
- [OPEN] **NOTIF-6.10: SMS Channel** | Assignee: — | Branch: — | Deps: [NOTIF-6.7] | Notes: Twilio/MSG91 integration, OTP support. Location: `backend/app/core/notifications/channels/sms.py`
- [OPEN] **NOTIF-6.11: Slack & Teams Channel** | Assignee: — | Branch: — | Deps: [NOTIF-6.7] | Notes: Webhook + Bot integration for Slack and MS Teams. Location: `backend/app/core/notifications/channels/slack_teams.py`
- [OPEN] **NOTIF-6.12: In-App Notifications** | Assignee: — | Branch: — | Deps: [NOTIF-6.7, AUTH-6.1] | Notes: WebSocket-based real-time notifications, notification center UI. Location: `backend/app/core/notifications/channels/in_app.py`

#### Workflow Engine

- [OPEN] **WF-6.13: Workflow Automation Engine** | Assignee: — | Branch: — | Deps: [AUTH-6.2] | Notes: Visual workflow builder, conditional logic, approval chains, triggers. Location: `backend/app/core/workflows/engine.py`
- [OPEN] **WF-6.14: Approval & Escalation System** | Assignee: — | Branch: — | Deps: [WF-6.13, NOTIF-6.7] | Notes: Multi-level approvals, SLA tracking, auto-escalation. Location: `backend/app/core/workflows/approvals.py`

#### Analytics & Simulation

- [OPEN] **ANLY-6.15: Predictive Analytics Engine** | Assignee: — | Branch: — | Deps: [DATA-5.1] | Notes: Time-series forecasting, trend detection, anomaly detection. Location: `backend/app/core/analytics/predictive.py`
- [OPEN] **ANLY-6.16: Simulation Engine** | Assignee: — | Branch: — | Deps: [ANLY-6.15] | Notes: What-if scenarios, Monte Carlo simulation, sensitivity analysis. Location: `backend/app/core/analytics/simulation.py`
- [OPEN] **ANLY-6.17: Executive Dashboards** | Assignee: — | Branch: — | Deps: [AUTH-6.2] | Notes: Configurable dashboards, widget system, real-time data refresh, export (PDF/Excel). Location: `frontend/src/components/common/dashboard/`
- [OPEN] **ANLY-6.22: Sentiment Analysis Engine** | Assignee: — | Branch: — | Deps: [AI-7.1, DATA-5.1] | Notes: NLP-based emotion/sentiment detection from text, multi-language support, trend tracking, context-aware scoring. Location: `backend/app/core/analytics/sentiment.py`
- [OPEN] **ANLY-6.23: ROI & Performance Tracking** | Assignee: — | Branch: — | Deps: [ANLY-6.15, DATA-5.1] | Notes: Cost-benefit analysis, productivity scorecards, benchmark comparisons, executive summary generation. Location: `backend/app/core/analytics/roi_tracking.py`
- [OPEN] **ANLY-6.24: Report Generation Engine** | Assignee: — | Branch: — | Deps: [ANLY-6.17] | Notes: Automated PDF/Excel/CSV export, template designer, scheduled delivery, branded reports. Location: `backend/app/core/analytics/reports.py`
- [OPEN] **ANLY-6.25: Orchestrator Agent** | Assignee: — | Branch: — | Deps: [AI-7.2, ANLY-6.15] | Notes: Central coordination agent for cross-domain insights, priority arbitration, auto-routing, learning memory. Location: `backend/app/core/ai_orchestration/orchestrator.py`

#### Observability & Governance

- [OPEN] **OBS-6.18: Audit Logging System** | Assignee: — | Branch: — | Deps: [AUTH-6.1] | Notes: Immutable audit trail, user action tracking, compliance reporting. Location: `backend/app/core/observability/audit.py`
- [OPEN] **OBS-6.19: Application Monitoring** | Assignee: — | Branch: — | Deps: [None] | Notes: Health checks, metrics collection, alerting, distributed tracing. Location: `backend/app/core/observability/monitoring.py`
- [OPEN] **OBS-6.20: Error Tracking & Incident Management** | Assignee: — | Branch: — | Deps: [OBS-6.19, NOTIF-6.7] | Notes: Error aggregation, incident creation, runbook automation. Location: `backend/app/core/observability/incidents.py`
- [OPEN] **OBS-6.21: Data Governance & Privacy Framework** | Assignee: — | Branch: — | Deps: [DATA-5.1, OBS-6.18] | Notes: PII masking, data retention policies, regional data residency rules, GDPR/CCPA compliance, consent management. Location: `backend/app/core/observability/data_governance.py`

#### Security & Encryption

- [OPEN] **SEC-6.22: Security & Data Encryption** | Assignee: — | Branch: — | Deps: [AUTH-6.1] | Notes: AES-256 encryption at rest, TLS 1.3 in transit, BYOK support, key rotation, vulnerability scanning. Location: `backend/app/core/auth/encryption.py`

#### Platform Configuration

- [OPEN] **PLAT-6.23: No-Code / Configuration Engine** | Assignee: — | Branch: — | Deps: [WF-6.13, AUTH-6.2] | Notes: Drag-and-drop workflow builder, rules engine, configurable thresholds, custom forms, template library. Location: `backend/app/core/workflows/no_code_engine.py`
- [OPEN] **PLAT-6.24: Feature Flag & Release Management** | Assignee: — | Branch: — | Deps: [AUTH-6.2] | Notes: Feature flags, canary releases, A/B testing, rollback support, beta access groups, version tagging. Location: `backend/app/core/gateway/feature_flags.py`
- [OPEN] **PLAT-6.25: Modular Architecture Service** | Assignee: — | Branch: — | Deps: [None] | Notes: Module registry, feature toggles per tenant, dependency mapping, phased rollout support. Location: `backend/app/core/gateway/modules.py`
- [OPEN] **PLAT-6.26: Real-Time Engine** | Assignee: — | Branch: — | Deps: [AUTH-6.1] | Notes: WebSocket connections, SSE streams, sub-100ms event delivery, pub/sub topic management, auto-reconnect. Location: `backend/app/core/gateway/realtime.py`
- [OPEN] **PLAT-6.27: IoT & Vision Gateway** | Assignee: — | Branch: — | Deps: [DATA-5.1, INT-4.1] | Notes: RTSP camera stream ingestion, MQTT/CoAP IoT telemetry, sensor data normalization, edge preprocessing. Location: `backend/app/core/data_infra/iot_gateway.py`
- [BLOCKED] **PLAT-6.28: Mobile-First Experience** | Assignee: — | Branch: — | Deps: [AUTH-6.1, UI-1, ANLY-6.17] | Notes: React Native cross-platform app, offline-first with local cache, push notifications, biometric login. Location: `frontend/src/mobile/`

---

### LAYER 5: DATA INFRASTRUCTURE

- [BUILT] **DATA-5.1: Database Setup & Models** | Assignee: @dev-2 | Branch: feature/core/database-setup | Deps: [None] | Notes: PostgreSQL setup, SQLAlchemy base models, Alembic migrations, connection pooling. Location: `backend/app/database.py`, `backend/app/shared/models/`
- [OPEN] **DATA-5.2: Vector Database Layer** | Assignee: — | Branch: — | Deps: [None] | Notes: Pinecone/Weaviate setup, embedding storage, semantic search API. Location: `backend/app/core/data_infra/vector_db.py`
- [OPEN] **DATA-5.3: ETL Pipeline Engine** | Assignee: — | Branch: — | Deps: [DATA-5.1] | Notes: Data extraction, transformation, loading; scheduled jobs; data validation. Location: `backend/app/core/data_infra/etl/`
- [OPEN] **DATA-5.4: Data Warehouse Connector** | Assignee: — | Branch: — | Deps: [DATA-5.1] | Notes: Snowflake/BigQuery connectors, data sync, schema management. Location: `backend/app/core/data_infra/warehouse.py`
- [OPEN] **DATA-5.5: Data Fabric & Cross-Product Data** | Assignee: — | Branch: — | Deps: [DATA-5.1, DATA-5.3] | Notes: Cross-product data mesh, data catalog, lineage tracking. Location: `backend/app/core/data_infra/fabric.py`
- [OPEN] **DATA-5.6: File Storage Service** | Assignee: — | Branch: — | Deps: [None] | Notes: S3/MinIO abstraction, file upload/download, presigned URLs, virus scanning. Location: `backend/app/core/data_infra/storage.py`

---

### LAYER 4: INTEGRATION LAYER

- [OPEN] **INT-4.1: Enterprise Data Connectors** | Assignee: — | Branch: — | Deps: [AUTH-6.1, GW-6.5] | Notes: REST API connector framework, webhook management, retry/circuit breaker. Location: `backend/app/core/integrations/engine.py`
- [OPEN] **INT-4.2: SAP Connector** | Assignee: — | Branch: — | Deps: [INT-4.1] | Notes: SAP RFC/OData integration, material master sync, financial posting. Location: `backend/app/core/integrations/sap.py`
- [OPEN] **INT-4.3: Oracle ERP Connector** | Assignee: — | Branch: — | Deps: [INT-4.1] | Notes: Oracle REST API integration, GL sync, procurement data. Location: `backend/app/core/integrations/oracle.py`
- [OPEN] **INT-4.4: Salesforce CRM Connector** | Assignee: — | Branch: — | Deps: [INT-4.1] | Notes: Salesforce API, lead/opportunity sync, custom object mapping. Location: `backend/app/core/integrations/salesforce.py`
- [OPEN] **INT-4.5: HRMS Connector** | Assignee: — | Branch: — | Deps: [INT-4.1] | Notes: SuccessFactors/Workday integration, employee data sync. Location: `backend/app/core/integrations/hrms.py`

---

### SHARED UTILITIES

- [OPEN] **SHARED-1: Base Models & Schemas** | Assignee: — | Branch: — | Deps: [DATA-5.1] | Notes: Pydantic base schemas, SQLAlchemy mixins (timestamps, soft-delete, audit), pagination. Location: `backend/app/shared/`
- [OPEN] **SHARED-2: Common Middleware** | Assignee: — | Branch: — | Deps: [AUTH-6.1] | Notes: CORS, request ID, rate limiting, error handling middleware. Location: `backend/app/shared/middleware/`
- [OPEN] **SHARED-3: Multi-Language Support** | Assignee: — | Branch: — | Deps: [None] | Notes: i18n framework for Arabic, English, Hindi; RTL support for frontend. Location: `backend/app/shared/utils/i18n.py`, `frontend/src/utils/i18n/`
- [OPEN] **SHARED-4: Voice Engine** | Assignee: — | Branch: — | Deps: [AI-7.1] | Notes: Speech-to-text, text-to-speech, voice command processing. Location: `backend/app/core/ai_orchestration/voice.py`
- [OPEN] **SHARED-5: Avatar Engine** | Assignee: — | Branch: — | Deps: [AI-7.1] | Notes: AI avatar for user interaction, persona management. Location: `backend/app/core/ai_orchestration/avatar.py`

---

### INTELLI DEPOT™ — Warehouse & Logistics

> **Prerequisite**: Core platform features (AUTH-6.1, DATA-5.1) should be BUILT first.

#### IntelliVision (Computer Vision Layer)

- [OPEN] **DEPOT-V1: Camera Feed Integration** | Assignee: — | Branch: — | Deps: [DATA-5.1, AUTH-6.1] | Notes: RTSP/IP camera stream ingestion, frame extraction, multi-camera management. Location: `backend/app/depot/vision/camera.py`
- [BLOCKED] **DEPOT-V2: Bag/Box Detection (Object Detection)** | Assignee: — | Branch: — | Deps: [DEPOT-V1, AI-7.1] | Notes: YOLO v8 model for bag/box detection, counting, size estimation. Location: `backend/app/depot/vision/detection.py`
- [BLOCKED] **DEPOT-V3: Automated Counting System** | Assignee: — | Branch: — | Deps: [DEPOT-V2] | Notes: Real-time counting from detection, tally reconciliation, discrepancy alerts. Location: `backend/app/depot/vision/counting.py`
- [BLOCKED] **DEPOT-V4: Cluster Mapping & Space Utilization** | Assignee: — | Branch: — | Deps: [DEPOT-V2] | Notes: Warehouse space heatmap, occupancy tracking, zone management. Location: `backend/app/depot/vision/cluster_mapping.py`
- [BLOCKED] **DEPOT-V5: FIFO/FILO/LIFO Logic Engine** | Assignee: — | Branch: — | Deps: [DEPOT-V4, DEPOT-INV1] | Notes: Stack ordering rules, age-based prioritization, visual compliance. Location: `backend/app/depot/vision/stack_logic.py`
- [BLOCKED] **DEPOT-V6: LPR & Gate Control** | Assignee: — | Branch: — | Deps: [DEPOT-V1, AUTH-6.1] | Notes: License plate recognition, automated gate open/close, vehicle logging. Location: `backend/app/depot/gate/lpr.py`
- [BLOCKED] **DEPOT-V7: Damage Detection** | Assignee: — | Branch: — | Deps: [DEPOT-V2] | Notes: Visual damage classification, severity scoring, photo evidence capture. Location: `backend/app/depot/vision/damage.py`

#### Operations Layer

- [BLOCKED] **DEPOT-OPS1: Task Assignment** | Assignee: — | Branch: — | Deps: [AUTH-6.2, DATA-5.1] | Notes: Skills-based assignment, load balancing, priority queuing, geo-proximity matching, auto-reassignment. Location: `backend/app/depot/operations/task_assignment.py`
- [BLOCKED] **DEPOT-OPS2: Guided Checklists** | Assignee: — | Branch: — | Deps: [DEPOT-OPS1, WF-6.13] | Notes: Step-by-step SOP guidance, photo/signature capture, compliance verification, offline support. Location: `backend/app/depot/operations/checklists.py`
- [BLOCKED] **DEPOT-OPS3: Exception Handling** | Assignee: — | Branch: — | Deps: [DEPOT-OPS1, AI-7.2] | Notes: Auto-classification, root cause detection, workflow routing, resolution tracking, pattern recognition. Location: `backend/app/depot/operations/exceptions.py`

#### Inventory Management

- [BLOCKED] **DEPOT-INV1: Inventory Management Core** | Assignee: — | Branch: — | Deps: [DATA-5.1, AUTH-6.2] | Notes: SKU management, stock levels, location tracking, barcode/QR support. Location: `backend/app/depot/inventory/core.py`
- [BLOCKED] **DEPOT-INV2: Stock Reconciliation** | Assignee: — | Branch: — | Deps: [DEPOT-INV1, DEPOT-V3] | Notes: Physical vs system count matching, variance reporting, auto-adjustment rules. Location: `backend/app/depot/inventory/reconciliation.py`
- [BLOCKED] **DEPOT-INV3: Reorder & Demand Forecasting** | Assignee: — | Branch: — | Deps: [DEPOT-INV1, ANLY-6.15] | Notes: Safety stock calculation, demand prediction, auto-reorder triggers. Location: `backend/app/depot/inventory/forecasting.py`
- [BLOCKED] **DEPOT-INV4: Expiry & Batch Tracking** | Assignee: — | Branch: — | Deps: [DEPOT-INV1] | Notes: Batch/lot tracking, expiry alerts, FEFO logic, recall management. Location: `backend/app/depot/inventory/batch_tracking.py`

#### Shipment & Logistics

- [BLOCKED] **DEPOT-SHIP1: Shipment Tracking** | Assignee: — | Branch: — | Deps: [DEPOT-INV1, INT-4.1] | Notes: Inbound/outbound shipments, carrier integration, status tracking, ETA prediction. Location: `backend/app/depot/shipment/tracking.py`
- [BLOCKED] **DEPOT-SHIP2: Dock & Bay Management** | Assignee: — | Branch: — | Deps: [DEPOT-SHIP1] | Notes: Dock scheduling, bay assignment, loading/unloading workflows. Location: `backend/app/depot/shipment/dock.py`
- [BLOCKED] **DEPOT-SHIP3: Route Optimization** | Assignee: — | Branch: — | Deps: [DEPOT-SHIP1, AI-7.2] | Notes: Delivery route planning, multi-stop optimization, real-time re-routing. Location: `backend/app/depot/shipment/routing.py`

#### Command Layer

- [BLOCKED] **DEPOT-CMD1: Live Monitoring** | Assignee: — | Branch: — | Deps: [PLAT-6.26, DEPOT-V1] | Notes: Multi-feed dashboard, threshold-based alerts, priority ranking, geo-view, drill-down. Location: `backend/app/depot/command/live_monitoring.py`
- [BLOCKED] **DEPOT-CMD2: Fleet & Yard View** | Assignee: — | Branch: — | Deps: [DEPOT-SHIP1, PLAT-6.27] | Notes: Fleet GPS tracking, yard slot management, dwell time analytics, dock scheduling, queue optimization. Location: `backend/app/depot/command/fleet_yard.py`
- [BLOCKED] **DEPOT-CMD3: Incident Escalation** | Assignee: — | Branch: — | Deps: [NOTIF-6.7, WF-6.14] | Notes: Auto-escalation rules, severity classification, multi-channel alerting, resolution workflows, audit trail. Location: `backend/app/depot/command/escalation.py`

#### Integration & Connectors

- [BLOCKED] **DEPOT-INT1: ERP Sync (SAP/Oracle)** | Assignee: — | Branch: — | Deps: [INT-4.2, INT-4.3] | Notes: Bi-directional sync, field mapping, conflict resolution, batch processing, real-time reconciliation. Location: `backend/app/depot/integrations/erp_sync.py`
- [BLOCKED] **DEPOT-INT2: IoT & Weather Feeds** | Assignee: — | Branch: — | Deps: [PLAT-6.27, INT-4.1] | Notes: Weather API integration, IoT sensor fusion, event correlation, threshold triggers, contextual alerts. Location: `backend/app/depot/integrations/iot_weather.py`
- [BLOCKED] **DEPOT-INT3: API Health Monitoring** | Assignee: — | Branch: — | Deps: [INT-4.1, OBS-6.19] | Notes: Health checks, latency monitoring, error rate tracking, auto-retry, failover routing. Location: `backend/app/depot/integrations/api_health.py`

#### Labor & Workforce

- [BLOCKED] **DEPOT-LAB1: Labor Management** | Assignee: — | Branch: — | Deps: [AUTH-6.2, DATA-5.1] | Notes: Shift scheduling, task assignment, productivity tracking. Location: `backend/app/depot/labor/management.py`
- [BLOCKED] **DEPOT-LAB2: Workforce Analytics** | Assignee: — | Branch: — | Deps: [DEPOT-LAB1, ANLY-6.15] | Notes: Performance metrics, utilization rates, optimization recommendations. Location: `backend/app/depot/labor/analytics.py`

#### Analytics & Risk

- [BLOCKED] **DEPOT-ANLY1: Operational KPIs** | Assignee: — | Branch: — | Deps: [ANLY-6.17, DATA-5.1] | Notes: Throughput KPIs, utilization rates, cost-per-unit metrics, benchmark comparisons, trend visualization. Location: `backend/app/depot/analytics/operational_kpis.py`
- [BLOCKED] **DEPOT-ANLY2: Compliance Monitoring** | Assignee: — | Branch: — | Deps: [OBS-6.18, WF-6.13] | Notes: Regulatory rule engine, auto-audit scheduling, non-compliance alerts, documentation tracking. Location: `backend/app/depot/analytics/compliance.py`
- [BLOCKED] **DEPOT-ANLY3: RBAC & Audit Logs** | Assignee: — | Branch: — | Deps: [AUTH-6.2, OBS-6.18] | Notes: Depot-specific role access, activity logging, tamper-proof audit trails, access anomaly detection. Location: `backend/app/depot/analytics/depot_audit.py`

#### Depot Orchestrator

- [BLOCKED] **DEPOT-ORCH1: Cross-Module Optimization** | Assignee: — | Branch: — | Deps: [ANLY-6.25, DEPOT-ANLY1] | Notes: Cross-module data analysis, multi-objective optimization, resource rebalancing, autonomous recommendations. Location: `backend/app/depot/orchestrator/cross_module.py`
- [BLOCKED] **DEPOT-ORCH2: Scenario Simulation** | Assignee: — | Branch: — | Deps: [ANLY-6.16, DEPOT-ORCH1] | Notes: Scenario builder, variable adjustment, impact visualization, side-by-side comparison, probability scoring. Location: `backend/app/depot/orchestrator/simulation.py`

#### Depot Dashboards & Reports

- [BLOCKED] **DEPOT-DASH1: Warehouse Dashboard** | Assignee: — | Branch: — | Deps: [ANLY-6.17, DEPOT-INV1, DEPOT-V4] | Notes: Real-time warehouse overview, KPIs, alerts. Location: `frontend/src/components/depot/dashboard/`
- [BLOCKED] **DEPOT-DASH2: Depot Reports & Analytics** | Assignee: — | Branch: — | Deps: [DEPOT-DASH1] | Notes: Operational reports, trend analysis, exportable reports. Location: `frontend/src/components/depot/reports/`

---

### INTELLI CAFE™ — Employee Engagement

> **Prerequisite**: Core platform features (AUTH-6.1, AUTH-6.2, DATA-5.1) should be BUILT first.

#### Collaboration Layer (Layer 1)

- [BLOCKED] **CAFE-FEED1: Social Feed** | Assignee: — | Branch: — | Deps: [AUTH-6.2, DATA-5.1, DATA-5.6] | Notes: Rich media posts, reactions & comments, hashtags, mentions, content pinning, moderation controls. Location: `backend/app/cafe/feed/posts.py`
- [BLOCKED] **CAFE-FEED2: Trending Topics** | Assignee: — | Branch: — | Deps: [CAFE-FEED1, AI-7.1] | Notes: Auto-trending algorithms, topic clustering, engagement velocity tracking, trending badges. Location: `backend/app/cafe/feed/trending.py`
- [BLOCKED] **CAFE-FEED3: Feedback Submission** | Assignee: — | Branch: — | Deps: [AUTH-6.2, WF-6.13] | Notes: Anonymous/named feedback, category tagging, photo attachments, upvoting, response tracking. Location: `backend/app/cafe/feedback/submission.py`
- [BLOCKED] **CAFE-FEED4: Suggestion Tracking** | Assignee: — | Branch: — | Deps: [CAFE-FEED3, WF-6.13] | Notes: Suggestion workflow, status tracking, owner assignment, impact scoring, follow-up reminders. Location: `backend/app/cafe/feedback/suggestions.py`
- [BLOCKED] **CAFE-TH1: AI Summary (Virtual Townhall)** | Assignee: — | Branch: — | Deps: [AUTH-6.2, AI-7.1, AI-7.3] | Notes: AI-generated meeting summaries, key action items, attendee insights, searchable archive, Q&A highlights. Location: `backend/app/cafe/townhall/summarizer.py`
- [BLOCKED] **CAFE-TH2: Interest Matching** | Assignee: — | Branch: — | Deps: [AUTH-6.2, DATA-5.1] | Notes: Interest-based matching, event scheduling, RSVP management, photo galleries, polls. Location: `backend/app/cafe/townhall/interest_matching.py`

#### Recognition Layer (Layer 2)

- [BLOCKED] **CAFE-ENG1: Good/Bad Karma Allocation** | Assignee: — | Branch: — | Deps: [AUTH-6.2, DATA-5.1] | Notes: Point allocation engine, good/bad karma rules, manager discretion, peer-to-peer awards, point balance. Location: `backend/app/cafe/engagement/karma.py`
- [BLOCKED] **CAFE-ENG2: Ledger & Reconciliation** | Assignee: — | Branch: — | Deps: [CAFE-ENG1] | Notes: Automated reconciliation, point expiry management, transaction history, dispute resolution, audit trails. Location: `backend/app/cafe/engagement/ledger.py`
- [BLOCKED] **CAFE-ENG3: Gamification & Badges** | Assignee: — | Branch: — | Deps: [CAFE-ENG1] | Notes: Badge library, achievement milestones, streak rewards, leaderboards, social sharing, level progression. Location: `backend/app/cafe/engagement/gamification.py`
- [BLOCKED] **CAFE-ENG4: Peer Recognition (Kudos)** | Assignee: — | Branch: — | Deps: [AUTH-6.2, NOTIF-6.7] | Notes: Peer-to-peer recognition, public praise walls, value-aligned kudos, manager endorsements. Location: `backend/app/cafe/engagement/recognition.py`
- [BLOCKED] **CAFE-ENG5: Reward Catalog** | Assignee: — | Branch: — | Deps: [CAFE-ENG1, INT-4.1] | Notes: Reward catalog, point redemption, vendor integration, wishlist, gift card options, shipping tracking. Location: `backend/app/cafe/engagement/rewards.py`

#### Learning Layer (Layer 3)

- [BLOCKED] **CAFE-LRN1: Micro Learning Modules** | Assignee: — | Branch: — | Deps: [AUTH-6.2, DATA-5.6] | Notes: Bite-sized modules, video/quiz/interactive formats, progress tracking, bookmarking, offline access. Location: `backend/app/cafe/learning/micro_learning.py`
- [BLOCKED] **CAFE-LRN2: Skill Certification** | Assignee: — | Branch: — | Deps: [CAFE-LRN1] | Notes: Certification workflows, skill verification, digital badges, expiry tracking, renewal reminders. Location: `backend/app/cafe/learning/certification.py`
- [BLOCKED] **CAFE-LRN3: Profile Discovery (KYC)** | Assignee: — | Branch: — | Deps: [AUTH-6.2, DATA-5.2] | Notes: Rich employee profiles, skill tags, interest mapping, org chart integration, connection suggestions. Location: `backend/app/cafe/learning/profile_discovery.py`
- [BLOCKED] **CAFE-LRN4: Policy Search (KYCO)** | Assignee: — | Branch: — | Deps: [AI-7.3, DATA-5.2] | Notes: Searchable policy repository, natural language queries, version control, context-aware results, FAQ bot. Location: `backend/app/cafe/learning/policy_search.py`

#### Wellness Layer (Layer 4)

- [BLOCKED] **CAFE-WELL1: Mindfulness Sessions** | Assignee: — | Branch: — | Deps: [AUTH-6.2, DATA-5.6] | Notes: Guided meditation library, session scheduling, progress tracking, mood logging, wellness reminders. Location: `backend/app/cafe/wellness/mindfulness.py`
- [BLOCKED] **CAFE-WELL2: Session Scheduling (Counselling)** | Assignee: — | Branch: — | Deps: [AUTH-6.2, NOTIF-6.7] | Notes: Confidential booking, therapist matching, session notes, follow-up scheduling, emergency escalation. Location: `backend/app/cafe/wellness/counselling.py`
- [BLOCKED] **CAFE-WELL3: Pulse Surveys** | Assignee: — | Branch: — | Deps: [AUTH-6.2, DATA-5.1] | Notes: Pulse survey builder, anonymous responses, trend analysis, benchmarking, real-time results. Location: `backend/app/cafe/wellness/pulse_surveys.py`
- [BLOCKED] **CAFE-WELL4: Periodic Check-ins** | Assignee: — | Branch: — | Deps: [CAFE-WELL3, AI-7.2] | Notes: Scheduled check-ins, self-assessment tools, manager nudges, trend monitoring, early warning flags. Location: `backend/app/cafe/wellness/checkins.py`

#### Analytics Layer (Layer 5)

- [BLOCKED] **CAFE-ANLY1: EQ Score Tracking** | Assignee: — | Branch: — | Deps: [ANLY-6.17, CAFE-ENG1, CAFE-WELL3] | Notes: EQ scoring model, multi-dimension tracking, team/dept/org views, historical trends, goal setting. Location: `backend/app/cafe/analytics/eq_score.py`
- [BLOCKED] **CAFE-ANLY2: Emotion Detection** | Assignee: — | Branch: — | Deps: [ANLY-6.22, CAFE-FEED1] | Notes: Multi-source emotion detection (text/survey/feedback), culture scoring, department-level analysis, alerts. Location: `backend/app/cafe/analytics/emotion.py`
- [BLOCKED] **CAFE-ANLY3: Usage Tracking** | Assignee: — | Branch: — | Deps: [ANLY-6.17, DATA-5.1] | Notes: Feature adoption funnels, active user tracking, session analytics, drop-off analysis, cohort comparison. Location: `backend/app/cafe/analytics/usage.py`
- [BLOCKED] **CAFE-ANLY4: Cost & Productivity Metrics** | Assignee: — | Branch: — | Deps: [ANLY-6.23, DATA-5.1] | Notes: Cost-per-engagement metrics, productivity correlation, absenteeism tracking, turnover impact analysis. Location: `backend/app/cafe/analytics/roi.py`

#### Integration Layer (Layer 6)

- [BLOCKED] **CAFE-INT1: Employee Data Sync (HRMS)** | Assignee: — | Branch: — | Deps: [INT-4.5] | Notes: Employee data sync, org hierarchy import, auto-onboarding triggers, profile enrichment, exit workflows. Location: `backend/app/cafe/integrations/hrms_sync.py`
- [BLOCKED] **CAFE-INT2: User Access Control (SSO)** | Assignee: — | Branch: — | Deps: [AUTH-6.3, AUTH-6.2] | Notes: SSO integration, MFA support, session management, auto-provisioning, deprovisioning workflows. Location: `backend/app/cafe/integrations/sso.py`
- [BLOCKED] **CAFE-INT3: Gift & Reward Accounting (Payroll)** | Assignee: — | Branch: — | Deps: [CAFE-ENG5, INT-4.5] | Notes: Gift accounting integration, tax compliance, reward cost tracking, budget allocation, reconciliation. Location: `backend/app/cafe/integrations/payroll.py`

#### Orchestrator Layer (Layer 7)

- [BLOCKED] **CAFE-ORCH1: Cross-Module Insights** | Assignee: — | Branch: — | Deps: [ANLY-6.25, CAFE-ANLY1] | Notes: Cross-module correlation, engagement-attrition linkage, predictive recommendations, unified scoring. Location: `backend/app/cafe/orchestrator/insights.py`
- [BLOCKED] **CAFE-ORCH2: Predictive Attrition Signals** | Assignee: — | Branch: — | Deps: [CAFE-ORCH1, ANLY-6.15] | Notes: Attrition risk scoring, flight risk alerts, behavioral pattern analysis, retention recommendations. Location: `backend/app/cafe/orchestrator/attrition.py`
- [BLOCKED] **CAFE-ORCH3: Intervention Playbooks** | Assignee: — | Branch: — | Deps: [CAFE-ORCH2, WF-6.13] | Notes: Playbook library, auto-triggered interventions, personalized action plans, impact tracking, A/B testing. Location: `backend/app/cafe/orchestrator/interventions.py`

---

### INTELLI RECRUIT™ — Talent Acquisition

> **Prerequisite**: Core platform features (AUTH-6.1, AUTH-6.2, DATA-5.1) should be BUILT first.

#### Sourcing Layer (Layer 1)

- [BLOCKED] **REC-JOB1: JD Auto Generation** | Assignee: — | Branch: — | Deps: [AI-7.1, AI-7.3, AUTH-6.2] | Notes: Role-specific JD templates, skill auto-tagging, tone adjustment, compliance checks, multi-format export. Location: `backend/app/recruit/jobs/jd_generator.py`
- [BLOCKED] **REC-JOB2: JD Skill Mapping** | Assignee: — | Branch: — | Deps: [REC-JOB1] | Notes: Taxonomy mapping, skill synonyms, industry-specific skill libraries, competency framework linking. Location: `backend/app/recruit/jobs/skill_mapping.py`
- [BLOCKED] **REC-SRC1: Multi-Channel Sourcing** | Assignee: — | Branch: — | Deps: [REC-JOB2, INT-4.1] | Notes: Job board aggregation, LinkedIn/GitHub sourcing, Boolean search, passive candidate identification, deduplication. Location: `backend/app/recruit/sourcing/multi_channel.py`
- [BLOCKED] **REC-SRC2: Talent Pool Creation** | Assignee: — | Branch: — | Deps: [REC-SRC1, DATA-5.2] | Notes: Dynamic segmentation, skill-based cohorts, warm candidate pools, engagement scoring, re-engagement triggers. Location: `backend/app/recruit/sourcing/talent_pool.py`
- [BLOCKED] **REC-OUT1: WhatsApp/Email Campaigns** | Assignee: — | Branch: — | Deps: [REC-SRC2, NOTIF-6.7, NOTIF-6.8, NOTIF-6.9] | Notes: Template personalization, multi-channel campaigns, A/B testing, open/response tracking. Location: `backend/app/recruit/outreach/campaigns.py`

#### Screening Layer (Layer 2)

- [BLOCKED] **REC-SCR1: CV Structuring (Resume Parsing)** | Assignee: — | Branch: — | Deps: [AI-7.1, REC-JOB2, DATA-5.2] | Notes: Multi-format parsing (PDF/DOC/LinkedIn), field extraction, normalization, duplicate detection, batch processing. Location: `backend/app/recruit/sourcing/resume_parser.py`
- [BLOCKED] **REC-SCR2: Fit Scoring** | Assignee: — | Branch: — | Deps: [REC-SCR1, REC-JOB2] | Notes: Multi-dimensional scoring, skill-role matching, experience weighting, culture fit indicators, explainable scores. Location: `backend/app/recruit/assessment/fit_scoring.py`
- [BLOCKED] **REC-SCR3: Ranking & Shortlisting** | Assignee: — | Branch: — | Deps: [REC-SCR2] | Notes: Composite ranking, configurable weights, tier-based shortlisting, auto-filtering, manual override. Location: `backend/app/recruit/assessment/ranking.py`
- [BLOCKED] **REC-SCR4: Diversity Checks** | Assignee: — | Branch: — | Deps: [REC-SCR2, OBS-6.18] | Notes: Gender/age/ethnicity bias detection, blind screening, compliance reporting, EEOC tracking, audit trails. Location: `backend/app/recruit/assessment/diversity.py`

#### Interview Layer (Layer 3)

- [BLOCKED] **REC-INT1: 24/7 AI Interviews** | Assignee: — | Branch: — | Deps: [AI-7.1, REC-JOB2] | Notes: AI-led interviews, adaptive questioning, real-time scoring, multi-language support, anti-cheating. Location: `backend/app/recruit/interviews/ai_interview.py`
- [BLOCKED] **REC-INT2: Skill-Based Tests** | Assignee: — | Branch: — | Deps: [REC-JOB2, AUTH-6.2] | Notes: Coding challenges, domain tests, aptitude assessments, auto-grading, difficulty calibration, proctoring. Location: `backend/app/recruit/assessment/skills.py`
- [BLOCKED] **REC-INT3: Interview Transcript Analysis** | Assignee: — | Branch: — | Deps: [REC-INT1, AI-7.1] | Notes: Transcript generation, sentiment analysis, keyword extraction, body language cues, summary generation. Location: `backend/app/recruit/interviews/video_analysis.py`
- [BLOCKED] **REC-INT4: Auto Calendar Sync** | Assignee: — | Branch: — | Deps: [REC-SRC2, NOTIF-6.7] | Notes: Calendar integration (Google/Outlook), time zone handling, conflict resolution, rescheduling, reminders. Location: `backend/app/recruit/interviews/scheduling.py`

#### Submission Layer (Layer 4)

- [BLOCKED] **REC-SUB1: Client-Ready Resume Format** | Assignee: — | Branch: — | Deps: [REC-SCR1] | Notes: Client-ready formatting, skill highlighting, anonymization options, batch packaging, brand templates. Location: `backend/app/recruit/submission/packaging.py`
- [BLOCKED] **REC-SUB2: Client Feedback Loop** | Assignee: — | Branch: — | Deps: [REC-SUB1, NOTIF-6.7] | Notes: Client portal, rating system, comment threads, decision tracking, SLA-based follow-ups. Location: `backend/app/recruit/submission/feedback.py`
- [BLOCKED] **REC-SUB3: Offer Letter Generation** | Assignee: — | Branch: — | Deps: [REC-SCR2, WF-6.13] | Notes: Template library, dynamic field population, e-signature integration, multi-currency, approval workflows. Location: `backend/app/recruit/assessment/offers.py`

#### Workflow Layer (Layer 5)

- [BLOCKED] **REC-WF1: Pipeline Health** | Assignee: — | Branch: — | Deps: [ANLY-6.17, REC-SRC2] | Notes: Pipeline visualization, stage-wise metrics, recruiter workload view, bottleneck identification, goal tracking. Location: `frontend/src/components/recruit/dashboard/`
- [BLOCKED] **REC-WF2: Time-to-Hire Tracking** | Assignee: — | Branch: — | Deps: [REC-WF1, WF-6.14] | Notes: Time-to-hire tracking, stage-wise SLA alerts, breach prediction, automated escalation, performance benchmarking. Location: `backend/app/recruit/workflow/sla.py`
- [BLOCKED] **REC-WF3: Task Automation** | Assignee: — | Branch: — | Deps: [WF-6.13, REC-SRC2] | Notes: Automated status updates, task routing, follow-up reminders, bulk actions, approval workflows. Location: `backend/app/recruit/workflow/automation.py`
- [BLOCKED] **REC-WF4: Hiring Audit Trail** | Assignee: — | Branch: — | Deps: [OBS-6.18, REC-SCR4] | Notes: Audit trail, compliance checklist automation, document verification, regulatory reporting, policy enforcement. Location: `backend/app/recruit/workflow/audit.py`

#### Analytics Layer (Layer 6)

- [BLOCKED] **REC-ANLY1: Cost-per-Hire Analysis** | Assignee: — | Branch: — | Deps: [ANLY-6.23, REC-WF1] | Notes: Cost-per-hire breakdown, source effectiveness, channel ROI, budget tracking, benchmark comparisons. Location: `backend/app/recruit/analytics/cost_analysis.py`
- [BLOCKED] **REC-ANLY2: Success Probability** | Assignee: — | Branch: — | Deps: [ANLY-6.15, REC-SCR2] | Notes: Success probability scoring, hiring outcome prediction, performance correlation, risk indicators. Location: `backend/app/recruit/analytics/success_prediction.py`
- [BLOCKED] **REC-ANLY3: Early Exit Risk** | Assignee: — | Branch: — | Deps: [ANLY-6.15, REC-ANLY2] | Notes: Early exit risk scoring, 90-day prediction, engagement signal monitoring, retention recommendations. Location: `backend/app/recruit/analytics/attrition.py`
- [BLOCKED] **REC-ANLY4: Inclusion Tracking** | Assignee: — | Branch: — | Deps: [REC-SCR4, ANLY-6.17] | Notes: Diversity pipeline tracking, inclusion scorecards, pay equity analysis, representation dashboards. Location: `backend/app/recruit/analytics/diversity.py`

#### Integration Layer (Layer 7)

- [BLOCKED] **REC-INTG1: Bi-Directional Sync (ATS)** | Assignee: — | Branch: — | Deps: [INT-4.1] | Notes: Bi-directional ATS sync, status propagation, duplicate handling, field mapping, error recovery. Location: `backend/app/recruit/integrations/ats_sync.py`
- [BLOCKED] **REC-INTG2: Client Data Sync (CRM)** | Assignee: — | Branch: — | Deps: [INT-4.4] | Notes: Client data sync, account mapping, contact enrichment, activity logging, revenue tracking. Location: `backend/app/recruit/integrations/crm_sync.py`
- [BLOCKED] **REC-INTG3: Employee Data Transfer (HRMS)** | Assignee: — | Branch: — | Deps: [INT-4.5, REC-SUB3] | Notes: Offer-to-HRMS transfer, employee record creation, document handoff, benefits enrollment trigger. Location: `backend/app/recruit/integrations/hrms_sync.py`
- [BLOCKED] **REC-INTG4: Webhook & Event Triggers** | Assignee: — | Branch: — | Deps: [INT-4.1, OBS-6.19] | Notes: Webhook management, event triggers, rate limiting, health monitoring, API documentation. Location: `backend/app/recruit/integrations/webhooks.py`

#### Orchestrator Layer (Layer 8)

- [BLOCKED] **REC-ORCH1: Cross-Module Intelligence** | Assignee: — | Branch: — | Deps: [ANLY-6.25, REC-ANLY1] | Notes: Cross-module analytics, multi-factor optimization, hiring strategy recommendations, unified intelligence. Location: `backend/app/recruit/orchestrator/intelligence.py`
- [BLOCKED] **REC-ORCH2: What-if Hiring Simulation** | Assignee: — | Branch: — | Deps: [ANLY-6.16, REC-ORCH1] | Notes: Scenario builder, headcount modeling, budget simulation, timeline impact analysis, side-by-side comparison. Location: `backend/app/recruit/orchestrator/simulation.py`
- [BLOCKED] **REC-ORCH3: Revenue & Margin Optimization** | Assignee: — | Branch: — | Deps: [REC-ORCH1, REC-ANLY1] | Notes: Revenue-per-hire tracking, margin analysis, pricing optimization, profitability dashboards, client-level P&L. Location: `backend/app/recruit/orchestrator/revenue.py`

---

### INTELLI STREAM™ — Financial Intelligence

> **Prerequisite**: Core platform features (AUTH-6.1, AUTH-6.2, DATA-5.1) and integration layer (INT-4.1) should be BUILT first.

#### Market Intelligence Layer (Layer 1)

- [BLOCKED] **STR-MP1: Interest Rate Monitoring** | Assignee: — | Branch: — | Deps: [DATA-5.1, INT-4.1, AI-7.1] | Notes: Real-time rate tracking, impact modeling, scenario overlays, central bank calendar, alert thresholds. Location: `backend/app/stream/macropulse/interest_rates.py`
- [BLOCKED] **STR-MP2: FX & Currency Exposure** | Assignee: — | Branch: — | Deps: [STR-MP1] | Notes: Multi-currency exposure tracking, hedge effectiveness, mark-to-market, volatility alerts, forward rate modeling. Location: `backend/app/stream/macropulse/fx_exposure.py`
- [BLOCKED] **STR-MP3: Commodity Tracking** | Assignee: — | Branch: — | Deps: [STR-MP1] | Notes: Commodity price tracking, supply chain cost impact, volatility analysis, procurement alerts. Location: `backend/app/stream/macropulse/commodities.py`
- [BLOCKED] **STR-CL1: Earnings Transcript Analysis** | Assignee: — | Branch: — | Deps: [AI-7.1, AI-7.3, DATA-5.2] | Notes: Earnings call parsing, key theme extraction, sentiment scoring, competitive comparison. Location: `backend/app/stream/competelens/earnings.py`
- [BLOCKED] **STR-CL2: Peer Benchmarking** | Assignee: — | Branch: — | Deps: [STR-CL1, DATA-5.1] | Notes: KPI-based peer comparison, financial ratio benchmarking, peer group management, ranking, gap analysis. Location: `backend/app/stream/competelens/benchmarking.py`
- [BLOCKED] **STR-CL3: Market Sentiment Tracking** | Assignee: — | Branch: — | Deps: [AI-7.1, INT-4.1] | Notes: News sentiment tracking, social media monitoring, analyst consensus tracking, momentum indicators. Location: `backend/app/stream/competelens/news_monitor.py`

#### Vendor Intelligence Layer (Layer 2)

- [BLOCKED] **STR-RR1: Credit Rating Monitoring** | Assignee: — | Branch: — | Deps: [DATA-5.1, INT-4.1] | Notes: Credit rating monitoring, rating change alerts, credit spread tracking, counterparty exposure scoring. Location: `backend/app/stream/riskradar/credit_rating.py`
- [BLOCKED] **STR-RR2: Distress Probability** | Assignee: — | Branch: — | Deps: [STR-RR1, AI-7.2, ANLY-6.15] | Notes: Financial distress scoring, Z-score modeling, cash flow stress testing, default probability estimation. Location: `backend/app/stream/riskradar/distress.py`
- [BLOCKED] **STR-GR1: Geopolitical Monitoring** | Assignee: — | Branch: — | Deps: [AI-7.1, INT-4.1] | Notes: Geopolitical event monitoring, country risk scoring, sanctions tracking, regulatory change alerts. Location: `backend/app/stream/riskradar/geopolitical.py`
- [BLOCKED] **STR-GR2: Port & Route Disruption** | Assignee: — | Branch: — | Deps: [STR-GR1, INT-4.1] | Notes: Port congestion tracking, route disruption alerts, alternative route suggestions, lead time impact analysis. Location: `backend/app/stream/riskradar/supply_chain.py`
- [BLOCKED] **STR-SLA1: On-Time Delivery Tracking** | Assignee: — | Branch: — | Deps: [INT-4.1, DATA-5.1] | Notes: OTD rate tracking, delivery performance scoring, trend analysis, vendor comparison, early warning alerts. Location: `backend/app/stream/riskradar/sla_tracking.py`
- [BLOCKED] **STR-SLA2: Penalty Exposure Calculation** | Assignee: — | Branch: — | Deps: [STR-SLA1, WF-6.13] | Notes: Penalty clause tracking, auto-calculation, escalation triggers, dispute management, financial impact view. Location: `backend/app/stream/riskradar/penalties.py`

#### Customer Intelligence Layer (Layer 3)

- [BLOCKED] **STR-CI1: CLV Modeling** | Assignee: — | Branch: — | Deps: [DATA-5.1, ANLY-6.15] | Notes: CLV calculation engine, cohort analysis, revenue attribution, churn-adjusted modeling, trend visualization. Location: `backend/app/stream/customer/clv.py`
- [BLOCKED] **STR-CI2: Revenue Concentration** | Assignee: — | Branch: — | Deps: [STR-CI1] | Notes: Revenue dependency analysis, client concentration tracking, risk-adjusted forecasting, what-if modeling. Location: `backend/app/stream/customer/revenue_concentration.py`
- [BLOCKED] **STR-CI3: Churn Prediction** | Assignee: — | Branch: — | Deps: [STR-CI1, AI-7.2] | Notes: Behavioral churn scoring, early warning signals, engagement decay tracking, win-back recommendations. Location: `backend/app/stream/customer/churn.py`
- [BLOCKED] **STR-CI4: Payment Behavior Tracking** | Assignee: — | Branch: — | Deps: [STR-CI1, DATA-5.1] | Notes: Payment pattern analysis, DSO tracking, late payment prediction, collection prioritization, risk scoring. Location: `backend/app/stream/customer/payment_behavior.py`
- [BLOCKED] **STR-CI5: Renewal Forecasting** | Assignee: — | Branch: — | Deps: [STR-CI1, ANLY-6.15] | Notes: Renewal probability scoring, contract expiry tracking, upsell timing, retention playbooks, auto-alerts. Location: `backend/app/stream/customer/renewals.py`
- [BLOCKED] **STR-CI6: Upsell Opportunity Detection** | Assignee: — | Branch: — | Deps: [STR-CI1, AI-7.2] | Notes: Cross-sell/upsell scoring, product affinity analysis, propensity modeling, revenue potential estimation. Location: `backend/app/stream/customer/upsell.py`

#### Predictive Intelligence Layer (Layer 4)

- [BLOCKED] **STR-PI1: What-if Simulations** | Assignee: — | Branch: — | Deps: [ANLY-6.16, DATA-5.1] | Notes: Variable adjustment, multi-factor scenarios, impact cascading, visual comparison, probability weighting. Location: `backend/app/stream/predictive/whatif.py`
- [BLOCKED] **STR-PI2: Impact Sensitivity Mapping** | Assignee: — | Branch: — | Deps: [STR-PI1] | Notes: Revenue/cost driver mapping, sensitivity coefficients, tornado charts, threshold alerts, stress testing. Location: `backend/app/stream/predictive/sensitivity.py`
- [BLOCKED] **STR-PI3: Revenue Forecasting** | Assignee: — | Branch: — | Deps: [ANLY-6.15, DATA-5.1] | Notes: Multi-model ensemble, time-series forecasting, confidence intervals, seasonality adjustment, accuracy tracking. Location: `backend/app/stream/predictive/revenue_forecast.py`
- [BLOCKED] **STR-PI4: Margin Sensitivity** | Assignee: — | Branch: — | Deps: [STR-PI3] | Notes: Margin driver analysis, cost sensitivity modeling, threshold alerts, trend forecasting, what-if margin impact. Location: `backend/app/stream/predictive/margin.py`

#### Analytics Layer (Layer 5)

- [BLOCKED] **STR-ANLY1: KPI Monitoring (Executive Dashboard)** | Assignee: — | Branch: — | Deps: [ANLY-6.17, STR-PI3] | Notes: Real-time KPI cards, drill-down views, custom layouts, trend overlays, peer comparison, mobile access. Location: `frontend/src/components/stream/dashboard/`
- [BLOCKED] **STR-ANLY2: Weekly CFO Brief** | Assignee: — | Branch: — | Deps: [AI-7.1, ANLY-6.24, STR-ANLY1] | Notes: Templated briefs, auto-narrative generation, key highlight extraction, anomaly callouts, scheduled delivery. Location: `backend/app/stream/analytics/cfo_brief.py`
- [BLOCKED] **STR-ANLY3: Real-Time Alerts** | Assignee: — | Branch: — | Deps: [NOTIF-6.7, PLAT-6.26] | Notes: Configurable thresholds, multi-channel delivery, priority routing, acknowledgment tracking, escalation chains. Location: `backend/app/stream/analytics/alerts.py`
- [BLOCKED] **STR-ANLY4: Confidence Scoring** | Assignee: — | Branch: — | Deps: [AI-7.5, OBS-6.18] | Notes: Model confidence scoring, decision explainability, bias detection, transparency reports, audit trails. Location: `backend/app/stream/analytics/confidence.py`

#### Integration Layer (Layer 6)

- [BLOCKED] **STR-INT1: SAP/Oracle Sync (ERP)** | Assignee: — | Branch: — | Deps: [INT-4.2, INT-4.3] | Notes: Bi-directional SAP/Oracle sync, real-time reconciliation, master data management, error handling, audit trails. Location: `backend/app/stream/financial_integrations/erp_sync.py`
- [BLOCKED] **STR-INT2: Customer Data Sync (CRM)** | Assignee: — | Branch: — | Deps: [INT-4.4] | Notes: Customer data sync, sales pipeline integration, account mapping, activity correlation, revenue linkage. Location: `backend/app/stream/financial_integrations/crm_sync.py`
- [BLOCKED] **STR-INT3: Snowflake/BigQuery (Data Warehouse)** | Assignee: — | Branch: — | Deps: [DATA-5.4] | Notes: Cloud DW connectivity, automated ETL, SQL query generation, scheduled data refresh, schema management. Location: `backend/app/stream/financial_integrations/dw_connector.py`
- [BLOCKED] **STR-INT4: Embedding Retrieval (Vector Store)** | Assignee: — | Branch: — | Deps: [DATA-5.2, AI-7.3] | Notes: Embedding storage, semantic search, document retrieval, context window management, RAG support. Location: `backend/app/stream/financial_integrations/vector_store.py`
- [BLOCKED] **STR-INT5: Banking API Integration** | Assignee: — | Branch: — | Deps: [INT-4.1, AUTH-6.1] | Notes: Bank statement import, balance queries, payment initiation. Location: `backend/app/stream/financial_integrations/banking.py`

#### Orchestrator Layer (Layer 7)

- [BLOCKED] **STR-ORCH1: Multi-Agent Coordination** | Assignee: — | Branch: — | Deps: [ANLY-6.25, STR-ANLY1] | Notes: Multi-agent coordination, cross-domain insights, priority arbitration, auto-routing, learning loops. Location: `backend/app/stream/orchestrator/coordinator.py`
- [BLOCKED] **STR-ORCH2: Cross-Domain Insight Synthesis** | Assignee: — | Branch: — | Deps: [STR-ORCH1, AI-7.2] | Notes: Cross-module correlation, pattern synthesis, narrative generation, holistic risk/opportunity scoring. Location: `backend/app/stream/orchestrator/synthesis.py`
- [BLOCKED] **STR-ORCH3: Automated Notification Dispatch** | Assignee: — | Branch: — | Deps: [NOTIF-6.7, STR-ORCH1] | Notes: Rule-based routing, multi-channel dispatch (Email/SMS/WhatsApp/Teams/Slack), scheduling, delivery tracking. Location: `backend/app/stream/orchestrator/notifications.py`

---

### FRONTEND SHELL & COMMON UI

- [OPEN] **UI-1: App Shell & Navigation** | Assignee: — | Branch: — | Deps: [None] | Notes: Main layout, sidebar, header, product switcher, responsive design. Location: `frontend/src/app/`
- [OPEN] **UI-2: Design System & Component Library** | Assignee: — | Branch: — | Deps: [None] | Notes: Tailwind + shadcn/ui setup, theme config, common components (Button, Input, Modal, Table, etc.). Location: `frontend/src/components/common/`
- [BLOCKED] **UI-3: Login & Auth Pages** | Assignee: — | Branch: — | Deps: [AUTH-6.1, UI-1] | Notes: Login, register, forgot password, MFA, SSO redirect. Location: `frontend/src/app/auth/`
- [BLOCKED] **UI-4: User Profile & Settings** | Assignee: — | Branch: — | Deps: [AUTH-6.1, AUTH-6.2, UI-1] | Notes: Profile page, preferences, notification settings, language selector. Location: `frontend/src/app/settings/`
- [BLOCKED] **UI-5: Admin Panel** | Assignee: — | Branch: — | Deps: [AUTH-6.2, AUTH-6.4, UI-1] | Notes: User management, role management, tenant config, system settings. Location: `frontend/src/app/admin/`

---

### PROJECT SETUP & DEVOPS

- [BUILT] **DEVOPS-1: Project Scaffolding** | Assignee: @claude-session-1 | Branch: feature/devops/project-scaffolding | Deps: [None] | Notes: Initialize backend (FastAPI), frontend (React/Next.js), docker-compose, .env.example, Makefile. Location: project root
- [OPEN] **DEVOPS-2: CI/CD Pipeline** | Assignee: — | Branch: — | Deps: [DEVOPS-1] | Notes: GitHub Actions for lint, test, build, deploy. Location: `.github/workflows/`
- [OPEN] **DEVOPS-3: Docker Configuration** | Assignee: — | Branch: — | Deps: [DEVOPS-1] | Notes: Dockerfiles for backend/frontend, docker-compose for local dev (PostgreSQL, Redis, MinIO). Location: `Dockerfile`, `docker-compose.yml`

---

## CONFLICT PREVENTION RULES

### Rule 1: One Feature = One Branch = One Person
Each feature must be worked on by exactly one person on exactly one branch. No shared branches.

### Rule 2: Pull Before You Claim
Always `git pull origin main` before changing a feature's status. If someone else claimed it in the meantime, pick another feature.

### Rule 3: Push Claims Immediately
After changing a status to `BUILDING`, commit and push ONLY this file immediately — before writing any code.

### Rule 4: Don't Touch Other People's Code
Only modify files within your feature's designated folder/location. If you need to modify a shared file (like `database.py`), coordinate with the team first.

### Rule 5: Interface Contracts for Dependencies
If your feature depends on another feature that's `BUILDING` (not yet `BUILT`):
- Create an interface/contract file defining what you need
- Document it in your feature's Notes
- The dependency owner must implement that interface when they complete their feature

### Rule 6: Merge Conflicts on This File
This file WILL have merge conflicts since multiple people update it. To resolve:
- Always take the **most advanced status** (BUILT > BUILDING > OPEN > BLOCKED > NOT_BUILT)
- Never downgrade a status during conflict resolution
- If unsure, communicate with the team

### Rule 7: Feature Completion Checklist
Before marking a feature as `BUILT`:
- [ ] All code is written and follows the folder structure
- [ ] Unit tests are written and passing
- [ ] API endpoints have OpenAPI documentation
- [ ] No hardcoded secrets or credentials
- [ ] Code is linted and formatted
- [ ] PR is created and ready for review

---

## QUICK REFERENCE: WHAT CAN BE BUILT IN PARALLEL RIGHT NOW

Features with `[OPEN]` status and `Deps: [None]` can be started **immediately** by different developers:

| Feature ID | Feature Name | Location |
|-----------|-------------|----------|
| NOTIF-6.7 | Notification Engine Core | `backend/app/core/notifications/` |
| DATA-5.2 | Vector Database Layer | `backend/app/core/data_infra/` |
| DATA-5.6 | File Storage Service | `backend/app/core/data_infra/` |
| OBS-6.19 | Application Monitoring | `backend/app/core/observability/` |
| PLAT-6.25 | Modular Architecture Service | `backend/app/core/gateway/` |
| SHARED-3 | Multi-Language Support | `backend/app/shared/utils/` |
| UI-1 | App Shell & Navigation | `frontend/src/app/` |
| UI-2 | Design System & Components | `frontend/src/components/common/` |

> **Recommended**: Start with **DEVOPS-1**, **AUTH-6.1**, **DATA-5.1**, and **AI-7.1** first — most other features depend on them.

---

## CHANGELOG

| Date | Feature | Status Change | By |
|------|---------|--------------|-----|
| 2026-03-23 | Document created | — | Initial setup |
| 2026-03-23 | DEVOPS-1: Project Scaffolding | BUILT | @claude-session-1 |
| 2026-03-23 | AUTH-6.1: Authentication System | BUILT | @claude-session-2 |
| 2026-03-23 | AI-7.1: LLM Orchestration Engine | BUILT | @dev-1 |
| 2026-03-23 | DATA-5.1: Database Setup & Models | BUILDING | @dev-2 |
| 2026-03-23 | DATA-5.1: Database Setup & Models | BUILT | @dev-2 |
| 2026-03-23 | AI-7.2: Multi-Agent Framework | BUILDING | @claude-session-2 |
| 2026-03-23 | AI-7.2: Multi-Agent Framework | BUILT | @claude-session-2 |
| 2026-03-23 | AI-7.4: Prompt Management System | BUILDING | @claude-session-3 |
| 2026-03-23 | AI-7.4: Prompt Management System | BUILT | @claude-session-3 |
| 2026-03-24 | AUTH-6.2: RBAC | BUILT | @Suraj |
| 2026-03-24 | AI-7.5: Explainability Engine (XAI) | BUILT | @Suraj |

---

*End of Development Tracker. Keep this document updated. Push after every change.*
