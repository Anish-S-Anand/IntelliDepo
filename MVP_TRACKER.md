# INTELLI PLATFORM — MVP DEVELOPMENT TRACKER

> **SINGLE SOURCE OF TRUTH** for the MVP sprint.
> Every developer and every Claude session MUST read this document before starting work.
> **MVP Scope**: Intelli Platform (core) + Intelli Depot + Intelli Stream (2 features only)
> Last updated: 2026-03-23

---

## TABLE OF CONTENTS

1. [How to Use This Document](#how-to-use-this-document)
2. [For Claude Sessions](#for-claude-sessions)
3. [Team & Sprint Plan](#team--sprint-plan)
4. [Project Overview](#project-overview)
5. [Tech Stack](#tech-stack)
6. [Folder Structure](#folder-structure)
7. [Git Workflow](#git-workflow)
8. [Status Legend](#status-legend)
9. [Feature Registry](#feature-registry)
10. [2-Week Day-by-Day Sprint Plan](#2-week-day-by-day-sprint-plan)
11. [Orange Feature MVP Scope](#orange-feature-mvp-scope)
12. [Conflict Prevention Rules](#conflict-prevention-rules)

---

## HOW TO USE THIS DOCUMENT

### For Developers (Humans)

1. **Before starting work**: `git pull origin main` to get the latest version of this file
2. **Check today's assignment**: Find your name in the [Sprint Plan](#2-week-day-by-day-sprint-plan)
3. **Claim it**: Change the feature's status to `BUILDING` and add your name as Assignee. **Push this change immediately.**
4. **Create a branch**: Use the branch name specified in the feature line
5. **Build the feature**: Work on your branch
6. **Mark complete**: Change status to `BUILT`, push this file update, then create a PR to merge into `main`
7. **After merge**: Ensure this file on `main` reflects `BUILT` for your feature

### CRITICAL RULES

- **ALWAYS pull before picking a feature** — someone else may have claimed it
- **ALWAYS push immediately after claiming** — prevents two people working on the same feature
- **NEVER work on a feature marked `BUILDING`** — someone else is on it
- **NEVER work on a feature marked `BLOCKED`** — its dependencies aren't ready
- **ALWAYS push this file after completing a feature** — others need to see the updated status
- **ONE feature per branch** — keeps PRs small and reviewable
- **Check `[ORANGE]` scope** — orange features have reduced MVP scope defined in [Orange Feature MVP Scope](#orange-feature-mvp-scope)

---

## FOR CLAUDE SESSIONS

> **Claude: Read this entire section before doing anything.**

You are being used by a developer to build a feature of the Intelli Platform MVP. Multiple developers are using separate Claude sessions simultaneously to build different features in parallel.

### What You Must Do

1. **Read this entire document first** — understand what's built, what's in progress, and what's available
2. **Check the Feature Registry** — only work on features with status `OPEN`
3. **Check dependencies** — if a feature has `Deps: [X, Y]`, verify X and Y are `BUILT` before proceeding
4. **Check MVP scope** — if a feature is tagged `[ORANGE]`, read the [Orange Feature MVP Scope](#orange-feature-mvp-scope) section for reduced scope
5. **Follow the folder structure** — place files exactly where the Folder Structure section specifies
6. **Follow the tech stack** — use only the technologies listed in Tech Stack
7. **Update this file** when you start (change to `BUILDING`) and when you finish (change to `BUILT`)
8. **Remind the developer to push** after every status change

### What You Must NOT Do

- Do NOT work on features marked `BUILDING`, `BUILT`, or `BLOCKED`
- Do NOT create folders or files outside the defined folder structure
- Do NOT install packages not listed in the tech stack without developer approval
- Do NOT modify code belonging to another feature's scope
- Do NOT assume a dependency is built — check its status in this document
- Do NOT build Intelli Cafe or Intelli Recruit features — they are **NOT in this MVP**
- Do NOT build features marked `[DEFERRED]` — they are excluded from MVP

### How to Handle Multiple Features in One Chat

If a developer asks you to build multiple features in one session:

1. Build them ONE AT A TIME
2. After each feature: update this file → remind developer to push → then start the next
3. Never start feature B while feature A's status update hasn't been pushed

### Import Conventions

When importing from other modules, use the folder structure paths. If a dependency module isn't `BUILT` yet, create an interface/contract file that defines what you expect from it, and note this in the feature's `Notes` field.

---

## TEAM & SPRINT PLAN

### Developers

| ID              | Name        | Focus Area                                                 |
| --------------- | ----------- | ---------------------------------------------------------- |
| **@Chetan**     | Developer 1 | Data infrastructure, analytics, gateway, connectors        |
| **@Keerthi**    | Developer 2 | Frontend, dashboards, UI, real-time engine, security       |
| **@Suraj**      | Developer 3 | AI/Backend core, RBAC, notifications, Stream, Depot vision |
| **@Pranishree** | Developer 4 | Observability, shared utils, Depot operations, testing     |

### Sprint Duration

- **10 working days** (2 weeks)
- **Week 1**: Foundation → Core Services → Analytics + Depot Start
- **Week 2**: Depot Command/Analytics → Stream → Orchestrator → Testing & Polish

---

## PROJECT OVERVIEW

**Intelli Platform** is Fidelis Digital's suite of AI-native enterprise products.

### MVP Products

| Product              | Description                                                    | Target Users      |
| -------------------- | -------------------------------------------------------------- | ----------------- |
| **Intelli Platform** | Shared core services (auth, AI, data, notifications)           | All products      |
| **Intelli Depot™**   | AI-powered warehouse & logistics management                    | Warehouse Ops     |
| **Intelli Stream™**  | CFO intelligence & financial analytics suite (2 features only) | Finance, Treasury |

> **NOT in MVP**: Intelli Cafe, Intelli Recruit

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

- **LLM Orchestration**: Custom engine (AI-7.1, already built)
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
├── MVP_TRACKER.md                 ← THIS FILE
├── DEVELOPMENT_TRACKER.md         ← Full project tracker (reference only)
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
│   │   │   ├── operations/         ← Task assignment, checklists
│   │   │   ├── command/            ← Live monitoring, fleet, escalation
│   │   │   ├── analytics/          ← KPIs, anomaly detection, audit
│   │   │   └── orchestrator/       ← Cross-module optimization
│   │   │
│   │   ├── stream/                 ← Intelli Stream product (MVP: 2 features)
│   │   │   └── riskradar/          ← Credit rating + distress only
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
│   │   │   ├── depot/              ← Depot dashboards & UI
│   │   │   └── stream/             ← Stream dashboards & UI
│   │   ├── hooks/                  ← Custom React hooks
│   │   ├── stores/                 ← Zustand stores
│   │   ├── services/               ← API client functions
│   │   ├── types/                  ← TypeScript types
│   │   └── utils/                  ← Frontend utilities
│   ├── public/
│   └── package.json
│
└── docs/                           ← Project documentation
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

- `feature/core/rbac`
- `feature/depot/bag-detection`
- `feature/stream/credit-rating`

### Workflow Steps

```
1. git pull origin main
2. Read MVP_TRACKER.md — find your assigned feature for today
3. Update feature status to BUILDING with your name
4. git add MVP_TRACKER.md && git commit -m "claim: <feature> — @<name>" && git push
5. git checkout -b feature/<product>/<feature-name>
6. === BUILD THE FEATURE ===
7. git add <your files> && git commit -m "feat(<scope>): <description>"
8. Update feature status to BUILT in MVP_TRACKER.md
9. git add MVP_TRACKER.md && git commit -m "tracker: mark <feature> as BUILT"
10. git push origin feature/<product>/<feature-name>
11. Create PR to merge into main
```

### Commit Message Format

```
<type>(<scope>): <description>

Types: feat, fix, refactor, test, docs, chore
Scope: core, depot, stream, shared
```

---

## STATUS LEGEND

| Status     | Meaning                                           | Who Can Change It                    |
| ---------- | ------------------------------------------------- | ------------------------------------ |
| `OPEN`     | Ready to be picked up, all dependencies are BUILT | Anyone (to BUILDING)                 |
| `BUILDING` | Someone is actively working on this               | Only the assignee (to BUILT)         |
| `BUILT`    | Complete, tested, merged to main                  | No one (final state)                 |
| `BLOCKED`  | Cannot start — dependencies not yet BUILT         | Auto (when deps become BUILT → OPEN) |
| `DEFERRED` | Excluded from MVP — do not build                  | No one                               |

### Special Tags

| Tag         | Meaning                                                                       |
| ----------- | ----------------------------------------------------------------------------- |
| `[ORANGE]`  | Reduced MVP scope — see [Orange Feature MVP Scope](#orange-feature-mvp-scope) |
| `[STRETCH]` | Build only if ahead of schedule (Day 9-10)                                    |

### Feature Line Format

```
- [STATUS] **ID: Feature Name** | Assignee: @name | Branch: feature/x/y | Deps: [A, B] | Day: N | Notes: ...
```

---

## FEATURE REGISTRY

> **IMPORTANT**: Before claiming a feature, always `git pull` and re-read this section.
> Features are listed in recommended build order within each section.

### Feature Count Summary

| Category                      | BUILT | To Build | DEFERRED | Total  |
| ----------------------------- | :---: | :------: | :------: | :----: |
| DevOps & Foundation           |   1   |    1     |    —     |   2    |
| AI Orchestration (Layer 7)    |   5   |    0     |    —     |   5    |
| Platform Services (Layer 6)   |   8   |    13    |    2     |   23   |
| Data Infrastructure (Layer 5) |   5   |    0     |    —     |   4    |
| Integration (Layer 4)         |   —   |    1     |    —     |   1    |
| Shared Utilities              |   2   |    1     |    —     |   3    |
| Frontend UI                   |   2   |    2     |    —     |   4    |
| Intelli Depot                 |   5   |    16    |    —     |   21   |
| Intelli Stream                |   1   |    2     |    —     |   3    |
| **TOTAL**                     | **28** |  **36**  |  **2**   | **66** |

> **MVP Build Scope: 64 features** (6 built + 58 to build). Additionally, ~40 features across Cafe, Recruit, and cut Depot/Stream/Platform items are deferred to post-MVP (listed in the [Deferred Features](#deferred-features-not-in-mvp) section).
>
> **Note on same-day dependencies**: DEPOT-OPS1→OPS2 (both Day 5, @Pranishree) and DEPOT-ANLY1→ANLY-AD (both Day 7, @Chetan) are same-day sequential deps — same developer builds them in order.

---

### ALREADY BUILT (Foundation — @Suraj)

These features are complete and available for all other features to depend on.

- [BUILT] **DEVOPS-1: Project Scaffolding** | Assignee: @Suraj | Branch: feature/devops/project-scaffolding | Deps: [None] | Notes: FastAPI backend, Next.js frontend, docker-compose, .env.example, Makefile
- [BUILT] **AUTH-6.1: Authentication System** | Assignee: @Suraj | Branch: feature/core/auth-system | Deps: [None] | Notes: JWT-based auth, login/logout, password reset, session management. Location: `backend/app/core/auth/`
- [BUILT] **DATA-5.1: Database Setup & Models** | Assignee: @Suraj | Branch: feature/core/database-setup | Deps: [None] | Notes: PostgreSQL setup, SQLAlchemy base models, Alembic migrations, connection pooling. Location: `backend/app/database.py`
- [BUILT] **AI-7.1: LLM Orchestration Engine** | Assignee: @Suraj | Branch: feature/core/llm-orchestration | Deps: [None] | Notes: Multi-model routing (OpenAI, Anthropic, local), fallback, cost tracking. Location: `backend/app/core/ai_orchestration/llm_engine.py`
- [BUILT] **AI-7.2: Multi-Agent Framework** | Assignee: @Suraj | Branch: feature/core/multi-agent-framework | Deps: [AI-7.1] | Notes: Agent lifecycle, task delegation, inter-agent communication, pipelines. Location: `backend/app/core/ai_orchestration/agent_framework.py`
- [BUILT] **AI-7.4: Prompt Management System** | Assignee: @Suraj | Branch: feature/core/prompt-management | Deps: [AI-7.1] | Notes: Prompt templates, versioning, A/B testing. Location: `backend/app/core/ai_orchestration/prompts/`
- [BUILT] **DEVOPS-3: Docker Configuration** | Assignee: @Pranishree | Branch: main | Deps: [DEVOPS-1] | Notes: Dockerfiles for backend/frontend, docker-compose for local dev (PostgreSQL, Redis, MinIO). Location: `Dockerfile`, `docker-compose.yml`
- [BUILT] **SHARED-1: Base Models & Schemas** | Assignee: @Pranishree | Branch: feature/shared/base-models | Deps: [DATA-5.1] | Notes: Pydantic base schemas, SQLAlchemy mixins (timestamps, soft-delete, audit), pagination. Location: `backend/app/shared/`
- [BUILT] **SHARED-2: Common Middleware** | Assignee: @Pranishree | Branch: feature/shared/middleware | Deps: [AUTH-6.1] | Notes: CORS, request ID, rate limiting, error handling middleware. Location: `backend/app/shared/middleware/`
- [BUILT] **OBS-6.18: Audit Logging System** | Assignee: @Pranishree | Branch: main | Deps: [AUTH-6.1] | Notes: Immutable audit trail, user action tracking, compliance reporting. Location: `backend/app/core/observability/audit.py`
- [BUILT] **OBS-6.19: Application Monitoring** | Assignee: @Pranishree | Branch: main | Deps: [None] | Notes: Health checks, metrics collection, alerting, distributed tracing. Location: `backend/app/core/observability/monitoring.py`
- [BUILT] **DEPOT-V1: Camera Feed Integration** | Assignee: @Pranishree | Branch: feature/depot/camera-feed | Deps: [DATA-5.1] | Notes: RTSP/IP camera stream ingestion, frame extraction, multi-camera management. Location: `backend/app/depot/vision/camera.py`
- [BUILT] **AUTH-6.2: RBAC (Role-Based Access Control)** | Assignee: @Keerthi | Branch: feature/core/rbac | Deps: [AUTH-6.1] | Notes: Roles, permissions, policy engine, multi-tenant support. Location: `backend/app/core/auth/rbac.py`
- [BUILT] **SEC-6.22: Security & Data Encryption** | Assignee: @Keerthi | Branch: feature/core/encryption | Deps: [AUTH-6.1] | Notes: AES-256 at rest, TLS 1.3 in transit, key rotation. Location: `backend/app/core/auth/encryption.py`
- [BUILT] **DATA-5.2: Vector Database Layer** | Assignee: @Keerthi | Branch: feature/core/vector-db | Deps: [None] | Notes: Pinecone/Weaviate setup, embedding storage, semantic search API. Location: `backend/app/core/data_infra/vector_db.py`
- [BUILT] **DATA-5.6: File Storage Service** | Assignee: @Keerthi | Branch: feature/core/file-storage | Deps: [None] | Notes: S3/MinIO abstraction, file upload/download, presigned URLs. Location: `backend/app/core/data_infra/storage.py`
- [BUILT] **PLAT-6.26: Real-Time Engine** | Assignee: @Keerthi | Branch: feature/core/realtime | Deps: [AUTH-6.1] | Notes: WebSocket connections, SSE streams, pub/sub, auto-reconnect. Location: `backend/app/core/gateway/realtime.py`
- [BUILT] **ANLY-6.22: Sentiment Analysis [ORANGE]** | Assignee: @Keerthi | Branch: feature/core/sentiment | Deps: [AI-7.1, DATA-5.1] | Notes: MVP: basic pos/neg/neutral, English only. Location: `backend/app/core/analytics/sentiment.py`
- [BUILT] **NOTIF-6.7: Notification Engine Core** | Assignee: @Keerthi | Branch: feature/core/notification-engine | Deps: [None] | Notes: Template system, delivery queue, retry logic, delivery tracking. Location: `backend/app/core/notifications/engine.py`
- [BUILT] **AI-7.3: RAG Framework** | Assignee: @Keerthi | Branch: feature/core/rag | Deps: [AI-7.1, DATA-5.2] | Notes: Retrieval-Augmented Generation, vector DB integration, chunking, embedding pipeline. Location: `backend/app/core/ai_orchestration/rag/`
- [BUILT] **AI-7.5: Explainability Engine (XAI)** | Assignee: @Keerthi | Branch: feature/core/explainability | Deps: [AI-7.1] | Notes: Transparent AI reasoning, decision audit trails, confidence scoring. Location: `backend/app/core/ai_orchestration/explainability.py`
- [BUILT] **DEPOT-V2: Bag/Box Detection** | Assignee: @Pranishree | Branch: feature/depot/bag-detection | Deps: [DEPOT-V1, AI-7.1] | Notes: YOLO v8 model for bag/box detection, counting, size estimation. Location: `backend/app/depot/vision/detection.py`
- [BUILT] **DEPOT-V7: Perimeter Monitoring** | Assignee: @Pranishree | Branch: feature/depot/perimeter | Deps: [DEPOT-V1] | Notes: Perimeter breach detection, unauthorized access alerts, zone-based monitoring. Location: `backend/app/depot/vision/perimeter.py`
- [BUILT] **DEPOT-INV1: Inventory Management Core** | Assignee: @Pranishree | Branch: feature/depot/inventory-core | Deps: [DATA-5.1, AUTH-6.2] | Notes: SKU management, stock levels, location tracking, barcode/QR support. Location: `backend/app/depot/inventory/core.py`
- [BUILT] **UI-1: App Shell & Navigation** | Assignee: @Keerthi | Branch: feature/shared/app-shell | Deps: [None] | Notes: Main layout, sidebar, header, product switcher, responsive design. Location: `frontend/src/app/`
- [BUILT] **UI-2: Design System & Component Library** | Assignee: @Keerthi | Branch: feature/shared/design-system | Deps: [None] | Notes: Tailwind + Shadcn setup, brand colors, core buttons/cards. Location: `frontend/src/components/ui/`
- [BUILT] **STR-DASH: Stream Dashboard** | Assignee: @Keerthi | Branch: feature/stream/dashboard | Deps: [STR-RR1, ANLY-6.17] | Notes: Credit rating + distress probability dashboard. Location: `frontend/src/components/stream/dashboard/`
- [BUILT] **ANLY-6.15: Predictive Analytics Engine** | Assignee: @Keerthi | Branch: feature/stream/macropulse-etl | Deps: [DATA-5.1] | Notes: ETL normalization, P&L sensitivity matrix (repo rate, FX, crude, WPI, G-Sec), Celery scheduler, news embedding pipeline. Location: `backend/app/stream/macropulse/ingestion/etl/`
- [BUILT] **DATA-5.4: Data Warehouse Connector** | Assignee: @Keerthi | Branch: feature/stream/macropulse-connectors | Deps: [DATA-5.1] | Notes: RBI/FRED, FX (Alpha Vantage + OXR), EIA crude, SAMA, CBUAE, IMF, World Bank connectors. Staging tables: macro_rates, fx_rates, commodity_prices, news_articles, tenant_profiles. Location: `backend/app/stream/macropulse/ingestion/connectors/`

---

### PROJECT SETUP & DEVOPS

- [BUILT] **DEVOPS-3: Docker Configuration** | Assignee: @Pranishree | Branch: main | Deps: [DEVOPS-1] | Day: 1 | Notes: Dockerfiles for backend/frontend, docker-compose for local dev (PostgreSQL, Redis, MinIO). Location: `Dockerfile`, `docker-compose.yml`

### LAYER 6: COMMON PLATFORM SERVICES

#### Authentication & Identity

- [BUILT] **AUTH-6.2: RBAC (Role-Based Access Control)** | Assignee: @Keerthi | Branch: feature/core/rbac | Deps: [AUTH-6.1] | Day: 1 | Notes: Roles, permissions, policy engine, multi-tenant support. Location: `backend/app/core/auth/rbac.py`
- [DEFERRED] ~~AUTH-6.3: SSO Integration~~ — Not in MVP
- [DEFERRED] ~~AUTH-6.4: Multi-Tenant & White Labeling~~ — Not in MVP

#### API Gateway

- [OPEN] **GW-6.5: Unified API Gateway** | Assignee: — | Branch: — | Deps: [AUTH-6.1] | Day: 2 | Notes: Rate limiting, request routing, API versioning, request/response logging. Location: `backend/app/core/gateway/`

#### Notifications

- [BUILT] **NOTIF-6.7: Notification Engine Core** | Assignee: @Keerthi | Branch: feature/core/notification-engine | Deps: [None] | Day: 2-3 | Notes: Template system, delivery queue, retry logic, delivery tracking. Location: `backend/app/core/notifications/engine.py`
- [BLOCKED] **NOTIF-6.12: In-App Notifications** | Assignee: — | Branch: — | Deps: [NOTIF-6.7, AUTH-6.1, PLAT-6.26] | Day: 4 | Notes: WebSocket-based real-time notifications, notification center. Location: `backend/app/core/notifications/channels/in_app.py`

#### Analytics & Simulation

- [BUILT] **ANLY-6.15: Predictive Analytics Engine** | Assignee: @Keerthi | Branch: feature/stream/macropulse-etl | Deps: [DATA-5.1] | Day: 3 | Notes: ETL normalization layer, P&L sensitivity matrix, time-series macro data pipeline (repo rate, FX, crude, WPI, G-Sec). Location: `backend/app/stream/macropulse/ingestion/etl/`
- [BLOCKED] **ANLY-6.16: Simulation Engine** | Assignee: — | Branch: — | Deps: [ANLY-6.15] | Day: 4 | Notes: What-if scenarios, Monte Carlo simulation, sensitivity analysis. Location: `backend/app/core/analytics/simulation.py`
- [BLOCKED] **ANLY-6.17: Executive Dashboards** | Assignee: — | Branch: — | Deps: [AUTH-6.2] | Day: 3-4 | Notes: Configurable dashboards, widget system, real-time data, export. Location: `frontend/src/components/common/dashboard/`
- [BUILT] **ANLY-6.22: Sentiment Analysis [ORANGE]** | Assignee: @Keerthi | Branch: feature/core/sentiment | Deps: [AI-7.1, DATA-5.1] | Day: 4 | Notes: MVP: basic pos/neg/neutral, English only. Location: `backend/app/core/analytics/sentiment.py`
- [BLOCKED] **ANLY-6.23: ROI & Performance Tracking [ORANGE]** | Assignee: — | Branch: — | Deps: [ANLY-6.15, DATA-5.1] | Day: 5 | Notes: MVP: basic KPI cards, manual data input. Location: `backend/app/core/analytics/roi_tracking.py`
- [BLOCKED] **ANLY-6.24: Report Generation Engine [ORANGE]** | Assignee: — | Branch: — | Deps: [ANLY-6.17] | Day: 5 | Notes: MVP: PDF export only, 1 default template. Location: `backend/app/core/analytics/reports.py`
- [BLOCKED] **ANLY-6.25: Orchestrator Agent** | Assignee: — | Branch: — | Deps: [AI-7.2, ANLY-6.15] | Day: 5 | Notes: Central coordination agent, cross-domain insights, priority arbitration. Location: `backend/app/core/ai_orchestration/orchestrator.py`

#### Observability & Governance

- [BUILT] **OBS-6.18: Audit Logging System** | Assignee: @Pranishree | Branch: main | Deps: [AUTH-6.1] | Day: 2 | Notes: Immutable audit trail, user action tracking, compliance reporting. Location: `backend/app/core/observability/audit.py`
- [BUILT] **OBS-6.19: Application Monitoring** | Assignee: @Pranishree | Branch: main | Deps: [None] | Day: 2 | Notes: Health checks, metrics collection, alerting, distributed tracing. Location: `backend/app/core/observability/monitoring.py`
- [BLOCKED] **OBS-6.20: SLA Monitoring** | Assignee: — | Branch: — | Deps: [OBS-6.19, DATA-5.1] | Day: 5 | Notes: Performance tracking against SLAs, breach prediction, trend analysis, alert thresholds. Location: `backend/app/core/observability/sla_monitoring.py`

#### Security

- [BUILT] **SEC-6.22: Security & Data Encryption** | Assignee: @Keerthi | Branch: feature/core/encryption | Deps: [AUTH-6.1] | Day: 2 | Notes: AES-256 at rest, TLS 1.3 in transit, key rotation. Location: `backend/app/core/auth/encryption.py`

#### Platform Configuration

- [BLOCKED] **PLAT-6.23: No-Code / Configuration Engine** | Assignee: — | Branch: — | Deps: [AUTH-6.2] | Day: 5 | Notes: Rules engine, configurable thresholds, custom forms. Location: `backend/app/core/workflows/no_code_engine.py`
- [OPEN] **PLAT-6.25: Modular Architecture Service** | Assignee: — | Branch: — | Deps: [None] | Day: 2 | Notes: Module registry, feature toggles per tenant, dependency mapping. Location: `backend/app/core/gateway/modules.py`
- [BUILT] **PLAT-6.26: Real-Time Engine** | Assignee: @Keerthi | Branch: feature/core/realtime | Deps: [AUTH-6.1] | Day: 2 | Notes: WebSocket connections, SSE streams, pub/sub, auto-reconnect. Location: `backend/app/core/gateway/realtime.py`
- [OPEN] **AI-MODEL: AI Model Management [ORANGE]** | Assignee: — | Branch: — | Deps: [AI-7.1] | Day: 4 | Notes: MVP: model registry listing + basic version tag only. Location: `backend/app/core/ai_orchestration/model_management.py`

#### Stretch

- [BLOCKED] **WF-6.13: Workflow Automation Engine [STRETCH]** | Assignee: — | Branch: — | Deps: [AUTH-6.2] | Day: 9-10 | Notes: Build only if ahead of schedule. Visual workflow builder, conditional logic, approval chains. Location: `backend/app/core/workflows/engine.py`

---

### LAYER 5: DATA INFRASTRUCTURE

- [BUILT] **DATA-5.2: Vector Database Layer** | Assignee: @Keerthi | Branch: feature/core/vector-db | Deps: [None] | Day: 1 | Notes: Pinecone/Weaviate setup, embedding storage, semantic search API. Location: `backend/app/core/data_infra/vector_db.py`
- [BUILT] **DATA-5.4: Data Warehouse Connector** | Assignee: @Keerthi | Branch: feature/stream/macropulse-connectors | Deps: [DATA-5.1] | Day: 3 | Notes: RBI/FRED, FX (Alpha Vantage + OXR), EIA crude, SAMA, CBUAE, IMF, World Bank connectors with Postgres staging tables (macro_rates, fx_rates, commodity_prices, news_articles). Location: `backend/app/stream/macropulse/ingestion/connectors/`
- [BUILT] **DATA-5.6: File Storage Service** | Assignee: @Keerthi | Branch: feature/core/file-storage | Deps: [None] | Day: 1 | Notes: S3/MinIO abstraction, file upload/download, presigned URLs. Location: `backend/app/core/data_infra/storage.py`

---

### LAYER 4: INTEGRATION LAYER

- [BLOCKED] **INT-4.1: Enterprise Data Connectors** | Assignee: — | Branch: — | Deps: [AUTH-6.1, GW-6.5] | Day: 4 | Notes: REST API connector framework, webhook management, retry/circuit breaker. Location: `backend/app/core/integrations/engine.py`

---

### SHARED UTILITIES

- [BUILT] **SHARED-1: Base Models & Schemas** | Assignee: @Pranishree | Branch: feature/shared/base-models | Deps: [DATA-5.1] | Day: 1 | Notes: Pydantic base schemas, SQLAlchemy mixins (timestamps, soft-delete, audit), pagination. Location: `backend/app/shared/`
- [BUILT] **SHARED-2: Common Middleware** | Assignee: @Pranishree | Branch: feature/shared/middleware | Deps: [AUTH-6.1] | Day: 1 | Notes: CORS, request ID, rate limiting, error handling middleware. Location: `backend/app/shared/middleware/`
- [OPEN] **SHARED-3: Multi-Language Support [ORANGE]** | Assignee: — | Branch: — | Deps: [None] | Day: 6 | Notes: MVP: English + Arabic UI labels only, basic RTL. Location: `backend/app/shared/utils/i18n.py`

---

### FRONTEND SHELL & COMMON UI

- [BUILT] **UI-1: App Shell & Navigation** | Assignee: @Keerthi | Branch: feature/shared/app-shell | Deps: [None] | Day: 1-2 | Notes: Main layout, sidebar, header, product switcher, responsive design. Location: `frontend/src/app/`
- [BUILT] **UI-2: Design System & Component Library** | Assignee: @Keerthi | Branch: feature/shared/design-system | Deps: [None] | Day: 1 | Notes: Tailwind + Shadcn setup, brand colors, core buttons/cards. Location: `frontend/src/components/ui/`
- [BLOCKED] **UI-3: Login & Auth Pages** | Assignee: — | Branch: — | Deps: [AUTH-6.1, UI-1] | Day: 3 | Notes: Login, register, forgot password, MFA pages. Location: `frontend/src/app/auth/`
- [BLOCKED] **UI-4: User Profile & Settings** | Assignee: — | Branch: — | Deps: [AUTH-6.2, UI-1] | Day: 4 | Notes: Profile page, preferences, notification settings. Location: `frontend/src/app/settings/`

---

### INTELLI DEPOT™ — Warehouse & Logistics

> **Prerequisite**: AUTH-6.1 ✅, DATA-5.1 ✅ are BUILT. AUTH-6.2 must be built Day 1.

#### IntelliVision (Computer Vision Layer)

- [BUILT] **DEPOT-V1: Camera Feed Integration** | Assignee: @Pranishree | Branch: feature/depot/camera-feed | Deps: [DATA-5.1] | Day: 3 | Notes: RTSP/IP camera stream ingestion, frame extraction, multi-camera management. Location: `backend/app/depot/vision/camera.py`
- [BUILT] **DEPOT-V2: Bag/Box Detection** | Assignee: @Pranishree | Branch: feature/depot/bag-detection | Deps: [DEPOT-V1, AI-7.1] | Day: 4 | Notes: YOLO v8 model for bag/box detection, counting, size estimation. Location: `backend/app/depot/vision/detection.py`
- [BLOCKED] **DEPOT-V3: Automated Counting** | Assignee: — | Branch: — | Deps: [DEPOT-V2] | Day: 6 | Notes: Real-time counting from detection, tally reconciliation, discrepancy alerts. Location: `backend/app/depot/vision/counting.py`
- [BLOCKED] **DEPOT-V4: Cluster Mapping** | Assignee: — | Branch: — | Deps: [DEPOT-V2] | Day: 6 | Notes: Warehouse space heatmap, occupancy tracking, zone management. Location: `backend/app/depot/vision/cluster_mapping.py`
- [BLOCKED] **DEPOT-V5: FIFO/FILO/LIFO Logic** | Assignee: — | Branch: — | Deps: [DEPOT-V4, DEPOT-INV1] | Day: 7 | Notes: Stack ordering rules, age-based prioritization, visual compliance. Location: `backend/app/depot/vision/stack_logic.py`
- [BUILT] **DEPOT-V7: Perimeter Monitoring** | Assignee: @Pranishree | Branch: feature/depot/perimeter | Deps: [DEPOT-V1] | Day: 4 | Notes: Perimeter breach detection, unauthorized access alerts, zone-based monitoring. Location: `backend/app/depot/vision/perimeter.py`

#### Operations Layer

- [BLOCKED] **DEPOT-OPS1: Task Assignment [ORANGE]** | Assignee: — | Branch: — | Deps: [AUTH-6.2, DATA-5.1] | Day: 5 | Notes: MVP: manual assignment with priority queue only. Location: `backend/app/depot/operations/task_assignment.py`
- [BLOCKED] **DEPOT-OPS2: Guided Checklists [ORANGE]** | Assignee: — | Branch: — | Deps: [DEPOT-OPS1] | Day: 5 | Notes: MVP: static checklist templates, completion tracking only. Location: `backend/app/depot/operations/checklists.py`

#### Inventory Management

- [BUILT] **DEPOT-INV1: Inventory Management Core** | Assignee: @Pranishree | Branch: feature/depot/inventory-core | Deps: [DATA-5.1, AUTH-6.2] | Day: 3-4 | Notes: SKU management, stock levels, location tracking, barcode/QR support. Built with AUTH-6.2 interface stub — will connect when RBAC is BUILT. Location: `backend/app/depot/inventory/core.py`

#### Command Layer

- [BLOCKED] **DEPOT-CMD1: Live Monitoring** | Assignee: — | Branch: — | Deps: [PLAT-6.26, DEPOT-V1] | Day: 6 | Notes: Multi-feed dashboard, threshold alerts, priority ranking, drill-down. Location: `backend/app/depot/command/live_monitoring.py`
- [BLOCKED] **DEPOT-CMD2: Fleet & Yard View** | Assignee: — | Branch: — | Deps: [DEPOT-INV1] | Day: 6 | Notes: Fleet tracking, yard slot management, dwell time analytics. Location: `backend/app/depot/command/fleet_yard.py`
- [BLOCKED] **DEPOT-CMD3: Incident Escalation** | Assignee: — | Branch: — | Deps: [NOTIF-6.7] | Day: 6 | Notes: Auto-escalation rules, severity classification, multi-channel alerting. Location: `backend/app/depot/command/escalation.py`
- [BLOCKED] **DEPOT-CMD4: SLA Tracking** | Assignee: — | Branch: — | Deps: [DEPOT-INV1, DATA-5.1] | Day: 6 | Notes: SLA breach prediction, threshold monitoring, performance scoring against SLAs, alert triggers. Location: `backend/app/depot/command/sla_tracking.py`

#### Integration

- [BLOCKED] **DEPOT-INT3: API Health Monitoring** | Assignee: — | Branch: — | Deps: [OBS-6.19, INT-4.1] | Day: 5 | Notes: Health checks, latency monitoring, error rate tracking, auto-retry. Location: `backend/app/depot/integrations/api_health.py`

#### Analytics & Risk

- [BLOCKED] **DEPOT-ANLY1: Operational KPIs** | Assignee: — | Branch: — | Deps: [ANLY-6.17, DATA-5.1] | Day: 7 | Notes: Throughput KPIs, utilization rates, cost-per-unit metrics, benchmarks. Location: `backend/app/depot/analytics/operational_kpis.py`
- [BLOCKED] **DEPOT-ANLY3: RBAC & Audit Logs** | Assignee: — | Branch: — | Deps: [AUTH-6.2, OBS-6.18] | Day: 6 | Notes: Depot-specific role access, activity logging, tamper-proof audit trails. Location: `backend/app/depot/analytics/depot_audit.py`
- [BLOCKED] **DEPOT-ANLY-AD: Anomaly Detection** | Assignee: — | Branch: — | Deps: [DEPOT-ANLY1] | Day: 7 | Notes: Anomaly detection in operations, fraud detection, alerting. Location: `backend/app/depot/analytics/anomaly.py`

#### Depot Orchestrator

- [BLOCKED] **DEPOT-ORCH1: Cross-Module Optimization** | Assignee: — | Branch: — | Deps: [ANLY-6.25, DEPOT-ANLY1] | Day: 8 | Notes: Cross-module data analysis, multi-objective optimization, recommendations. Location: `backend/app/depot/orchestrator/cross_module.py`
- [BLOCKED] **DEPOT-ORCH2: Scenario Simulation** | Assignee: — | Branch: — | Deps: [ANLY-6.16, DEPOT-ORCH1] | Day: 9 | Notes: Scenario builder, variable adjustment, impact visualization, comparison. Location: `backend/app/depot/orchestrator/simulation.py`
- [BLOCKED] **DEPOT-ORCH-RL: Revenue Leakage Detection** | Assignee: — | Branch: — | Deps: [DEPOT-ORCH1] | Day: 9 | Notes: Revenue leakage identification, root cause analysis, recovery recommendations. Location: `backend/app/depot/orchestrator/revenue_leakage.py`

#### Depot Dashboard

- [BLOCKED] **DEPOT-DASH1: Warehouse Dashboard** | Assignee: — | Branch: — | Deps: [ANLY-6.17, DEPOT-INV1] | Day: 7-8 | Notes: Real-time warehouse overview, KPIs, alerts. Location: `frontend/src/components/depot/dashboard/`

---

### INTELLI STREAM™ — Financial Intelligence (MVP: 2 Features Only)

> **MVP Scope**: Only Credit Rating Monitoring and Distress Probability.
> All other Stream features are deferred to post-MVP.

- [BLOCKED] **STR-RR1: Credit Rating Monitoring** | Assignee: — | Branch: — | Deps: [DATA-5.1, INT-4.1] | Day: 7 | Notes: Credit rating tracking, rating change alerts, credit spread tracking, counterparty exposure. Location: `backend/app/stream/riskradar/credit_rating.py`
- [BLOCKED] **STR-RR2: Distress Probability** | Assignee: — | Branch: — | Deps: [STR-RR1, AI-7.2, ANLY-6.15] | Day: 8 | Notes: Financial distress scoring, Z-score modeling, cash flow stress testing, default probability. Location: `backend/app/stream/riskradar/distress.py`
- [BUILT] **STR-DASH: Stream Dashboard** | Assignee: @Keerthi | Branch: feature/stream/dashboard | Deps: [STR-RR1, ANLY-6.17] | Day: 8 | Notes: Credit rating + distress probability dashboard. Location: `frontend/src/components/stream/dashboard/`

---

### DEFERRED FEATURES (Not in MVP)

> **Claude: Do NOT build any of these features.**

#### Excluded from Intelli Platform

- ~~AI Agent Architecture (full production version)~~
- ~~Predictive Analytics (full platform — basic version built into ANLY-6.15 instead)~~
- ~~SSO & Identity Management~~
- ~~Centralized Notification Hub~~
- ~~Data Governance & Privacy Framework~~
- ~~Master Identity & User Service~~
- ~~Feature Flag & Release Management~~
- ~~API Marketplace / SDK Layer~~

#### Excluded from Intelli Depot

- ~~LPR & Gate Control~~
- ~~Space Optimization~~
- ~~Exception Handling~~
- ~~ERP Sync (SAP/Oracle)~~
- ~~IoT & Weather Feeds~~
- ~~Predictive Forecasting~~
- ~~Compliance Monitoring~~
- ~~Batch/Expiry Monitoring~~

#### Excluded from Intelli Stream (everything except Credit Rating + Distress)

- ~~All of Layer 1 (MacroPulse, CompeteLens)~~
- ~~GeoRisk, SLA Monitor~~
- ~~All of Layer 3 (Customer Intelligence)~~
- ~~All of Layer 4 (Predictive Intelligence)~~
- ~~All of Layer 5 (Analytics)~~
- ~~All of Layer 6 (Integration)~~
- ~~All of Layer 7 (Orchestrator)~~

#### Excluded Products

- ~~Intelli Cafe (entire product)~~
- ~~Intelli Recruit (entire product)~~

---

## 2-WEEK DAY-BY-DAY SPRINT PLAN

### WEEK 1

#### Day 1 (Mon) — Foundation Sprint

| Developer       | Feature(s)                                                      | Notes                                                            |
| --------------- | --------------------------------------------------------------- | ---------------------------------------------------------------- |
| **@Suraj**      | AUTH-6.2: RBAC                                                  | Roles, permissions, policy engine. Many features depend on this. |
| **@Chetan**     | DATA-5.2: Vector DB Layer + DATA-5.6: File Storage              | Both have no deps, can start immediately.                        |
| **@Keerthi**    | UI-1: App Shell + UI-2: Design System                           | Frontend foundation — layout, sidebar, components.               |
| **@Pranishree** | SHARED-1: Base Models + SHARED-2: Middleware + DEVOPS-3: Docker | Shared utilities + Docker for local dev setup.                   |

#### Day 2 (Tue) — Core Services

| Developer       | Feature(s)                                            | Notes                                                   |
| --------------- | ----------------------------------------------------- | ------------------------------------------------------- |
| **@Suraj**      | AI-7.5: Explainability Engine + AI-7.3: RAG (start)   | XAI needs AI-7.1 ✅. RAG needs DATA-5.2 (Chetan Day 1). |
| **@Chetan**     | GW-6.5: API Gateway + PLAT-6.25: Modular Architecture | Gateway needs AUTH-6.1 ✅.                              |
| **@Keerthi**    | PLAT-6.26: Real-Time Engine + SEC-6.22: Security      | WebSocket/SSE + encryption layer.                       |
| **@Pranishree** | OBS-6.18: Audit Logging + OBS-6.19: App Monitoring    | Observability stack.                                    |

#### Day 3 (Wed) — Analytics Foundation + Depot Start

| Developer       | Feature(s)                                                  | Notes                                         |
| --------------- | ----------------------------------------------------------- | --------------------------------------------- |
| **@Suraj**      | AI-7.3: RAG (finish) + NOTIF-6.7: Notification Engine       | RAG needs DATA-5.2. Notification has no deps. |
| **@Chetan**     | ANLY-6.15: Predictive Analytics + DATA-5.4: DW Connector    | Analytics engine foundation.                  |
| **@Keerthi**    | UI-3: Login Pages + ANLY-6.17: Executive Dashboards (start) | Auth pages + dashboard framework.             |
| **@Pranishree** | DEPOT-V1: Camera Feed + DEPOT-INV1: Inventory Core          | Start Depot product! Camera + inventory.      |

#### Day 4 (Thu) — Analytics + Depot Vision

| Developer       | Feature(s)                                                       | Notes                                                           |
| --------------- | ---------------------------------------------------------------- | --------------------------------------------------------------- |
| **@Suraj**      | NOTIF-6.12: In-App Notifications + ANLY-6.22: Sentiment [ORANGE] | In-app needs NOTIF-6.7. Sentiment: basic only.                  |
| **@Chetan**     | ANLY-6.16: Simulation Engine + INT-4.1: Enterprise Connectors    | Simulation needs ANLY-6.15. Connectors needed for Stream.       |
| **@Keerthi**    | ANLY-6.17: Dashboards (finish) + UI-4: User Profile              | Dashboard + profile pages.                                      |
| **@Pranishree** | DEPOT-V2: Bag/Box Detection + DEPOT-V7: Perimeter Monitoring     | V2/V7 need V1 (Day 3). V2 is YOLO model setup — full day focus. |

#### Day 5 (Fri) — Depot Operations + Platform Services

| Developer       | Feature(s)                                                                                    | Notes                                                                                |
| --------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **@Suraj**      | ANLY-6.25: Orchestrator Agent + AI-MODEL: Model Mgmt [ORANGE]                                 | Orchestrator needs AI-7.2 + ANLY-6.15. Model mgmt: registry only.                    |
| **@Chetan**     | ANLY-6.23: ROI [ORANGE] + ANLY-6.24: Reports [ORANGE]                                         | Both reduced scope. ROI: KPI cards. Reports: PDF only.                               |
| **@Keerthi**    | PLAT-6.23: No-Code Engine + DEPOT-INT3: API Health                                            | No-Code needs AUTH-6.2 (Day 1). API Health needs OBS-6.19 (Day 2) + INT-4.1 (Day 4). |
| **@Pranishree** | DEPOT-OPS1: Task Assign [ORANGE] + DEPOT-OPS2: Checklists [ORANGE] + OBS-6.20: SLA Monitoring | OPS1: manual assign only. OPS2 needs OPS1. SLA Mon needs OBS-6.19 (Day 2).           |

---

### WEEK 2

#### Day 6 (Mon) — Depot Command Layer

| Developer       | Feature(s)                                                                               | Notes                                                                      |
| --------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **@Suraj**      | DEPOT-V4: Cluster Mapping + DEPOT-V5: FIFO/LIFO (start)                                  | Cluster needs V2 (Day 4). FIFO needs V4 + INV1.                            |
| **@Chetan**     | DEPOT-CMD1: Live Monitoring + DEPOT-CMD3: Incident Escalation + DEPOT-CMD4: SLA Tracking | Live Mon needs PLAT-6.26 + V1. Escalation needs NOTIF-6.7. SLA needs INV1. |
| **@Keerthi**    | DEPOT-DASH1: Warehouse Dashboard + DEPOT-CMD2: Fleet & Yard                              | Dashboard needs ANLY-6.17 + INV1.                                          |
| **@Pranishree** | DEPOT-V3: Counting + DEPOT-ANLY3: RBAC & Audit + SHARED-3: Multi-Language [ORANGE]       | V3 needs V2 (Day 4). Audit needs AUTH-6.2 + OBS-6.18. i18n: EN + AR only.  |

#### Day 7 (Tue) — Depot Analytics + Stream Start

| Developer       | Feature(s)                                                       | Notes                                                            |
| --------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| **@Suraj**      | DEPOT-V5: FIFO/LIFO (finish) + STR-RR1: Credit Rating            | Stream starts! Needs DATA-5.1 ✅ + INT-4.1 (Day 4).              |
| **@Chetan**     | DEPOT-ANLY1: Operational KPIs + DEPOT-ANLY-AD: Anomaly Detection | KPIs need ANLY-6.17 + DATA-5.1. Anomaly needs KPIs.              |
| **@Keerthi**    | DEPOT-DASH1: Dashboard polish + frontend integration testing     | Connect all Depot components to dashboard.                       |
| **@Pranishree** | Test Depot vision pipeline + test operations flow                | E2E: camera → detection → counting. Ops: task → checklist → SLA. |

#### Day 8 (Wed) — Stream + Depot Orchestrator

| Developer       | Feature(s)                                            | Notes                                          |
| --------------- | ----------------------------------------------------- | ---------------------------------------------- |
| **@Suraj**      | STR-RR2: Distress Probability                         | Needs STR-RR1 (Day 7) + AI-7.2 ✅ + ANLY-6.15. |
| **@Chetan**     | DEPOT-ORCH1: Cross-Module Optimization                | Needs ANLY-6.25 + DEPOT-ANLY1.                 |
| **@Keerthi**    | STR-DASH: Stream Dashboard (Credit Rating + Distress) | Simple dashboard for the 2 Stream features.    |
| **@Pranishree** | Integration testing — Depot operations flow           | Task → checklist → monitoring → escalation.    |

#### Day 9 (Thu) — Orchestrator + Stretch Goals

| Developer       | Feature(s)                                                        | Notes                                  |
| --------------- | ----------------------------------------------------------------- | -------------------------------------- |
| **@Suraj**      | DEPOT-ORCH2: Scenario Simulation + DEPOT-ORCH-RL: Revenue Leakage | Both need DEPOT-ORCH1 (Day 8).         |
| **@Chetan**     | WF-6.13: Workflow Automation [STRETCH]                            | Stretch goal — build only if on track. |
| **@Keerthi**    | Polish all dashboards + responsive/mobile testing                 | Executive, Depot, Stream dashboards.   |
| **@Pranishree** | End-to-end testing all Depot features                             | Full workflow testing with mock data.  |

#### Day 10 (Fri) — Integration, Testing, Polish

| Developer       | Feature(s)                                          | Notes                                        |
| --------------- | --------------------------------------------------- | -------------------------------------------- |
| **@Suraj**      | Cross-product integration testing + bug fixes       | Test AI orchestration across all products.   |
| **@Chetan**     | Analytics pipeline testing + bug fixes              | Test predictive → simulation → reports flow. |
| **@Keerthi**    | UI polish, error states, loading states + bug fixes | Final frontend pass.                         |
| **@Pranishree** | Full regression testing + documentation             | Test everything end-to-end, update tracker.  |

---

## ORANGE FEATURE MVP SCOPE

> Features tagged `[ORANGE]` have reduced scope for the MVP. Claude: when building these, **only** implement the MVP scope — do NOT build the full version.

| Feature                           | Full Scope                                             | MVP Scope (Build This Only)                                  |
| --------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------ |
| **ANLY-6.22: Sentiment Analysis** | Multi-language, context-aware, trend tracking, scoring | English-only, basic positive/negative/neutral classification |
| **ANLY-6.23: ROI & Performance**  | Benchmarks, scorecards, productivity correlation       | Basic KPI cards with manual data input                       |
| **ANLY-6.24: Report Generation**  | PDF/Excel/CSV, template designer, scheduling, branding | PDF export only, 1 default template, no scheduling           |
| **AI-MODEL: AI Model Management** | Versioning, drift monitoring, A/B testing, confidence  | Model registry listing + basic version tag only              |
| **SHARED-3: Multi-Language**      | Full i18n framework, RTL, AI translation               | English + Arabic UI labels, basic RTL support                |
| **DEPOT-OPS1: Task Assignment**   | AI auto-routing, skills matching, load balancing       | Manual assignment with priority queue only                   |
| **DEPOT-OPS2: Guided Checklists** | AI-generated SOPs, photo capture, offline support      | Static checklist templates, completion tracking only         |

---

## CONFLICT PREVENTION RULES

### Rule 1: One Feature = One Branch = One Person

Each feature must be worked on by exactly one person on exactly one branch.

### Rule 2: Pull Before You Claim

Always `git pull origin main` before changing a feature's status.

### Rule 3: Push Claims Immediately

After changing a status to `BUILDING`, commit and push ONLY this file immediately — before writing any code.

### Rule 4: Don't Touch Other People's Code

Only modify files within your feature's designated folder/location. If you need to modify a shared file (like `main.py`), coordinate with the team first.

### Rule 5: Interface Contracts for Dependencies

If your feature depends on another feature that's `BUILDING` (not yet `BUILT`):

- Create an interface/contract file defining what you need
- Document it in your feature's Notes
- The dependency owner must implement that interface when they complete their feature

### Rule 6: Merge Conflicts on This File

This file WILL have merge conflicts since multiple people update it. To resolve:

- Always take the **most advanced status** (BUILT > BUILDING > OPEN > BLOCKED)
- Never downgrade a status during conflict resolution

### Rule 7: Feature Completion Checklist

Before marking a feature as `BUILT`:

- [ ] All code is written and follows the folder structure
- [ ] Unit tests are written and passing
- [ ] API endpoints have OpenAPI documentation
- [ ] No hardcoded secrets or credentials
- [ ] Code is linted and formatted
- [ ] PR is created and ready for review

---

## QUICK REFERENCE: DAY 1-2 STATUS

Already built and moved into the BUILT sections above:

| Feature ID | Feature Name         | Day | Status | Assignee    |
| ---------- | -------------------- | --- | ------ | ----------- |
| AUTH-6.2   | RBAC                 | 1   | BUILT  | @Keerthi    |
| DATA-5.2   | Vector DB Layer      | 1   | BUILT  | @Keerthi    |
| DATA-5.6   | File Storage         | 1   | BUILT  | @Keerthi    |
| DEVOPS-3   | Docker Configuration | 1   | BUILT  | @Pranishree |
| SHARED-1   | Base Models          | 1   | BUILT  | @Pranishree |
| SHARED-2   | Middleware           | 1   | BUILT  | @Pranishree |
| UI-1       | App Shell            | 1   | BUILT  | @Keerthi    |
| UI-2       | Design System        | 1   | BUILT  | @Keerthi    |
| OBS-6.18   | Audit Logging        | 2   | BUILT  | @Pranishree |
| OBS-6.19   | App Monitoring       | 2   | BUILT  | @Pranishree |
| SEC-6.22   | Security & Encryption| 2   | BUILT  | @Keerthi    |
| PLAT-6.26  | Real-Time Engine     | 2   | BUILT  | @Keerthi    |

Still open from the original Day 1-2 schedule:

| Feature ID | Feature Name         | Day | Status | Assignee |
| ---------- | -------------------- | --- | ------ | -------- |
| GW-6.5     | Unified API Gateway  | 2   | OPEN   | —        |
| PLAT-6.25  | Modular Architecture | 2   | OPEN   | —        |

---

## CHANGELOG

| Date       | Feature                           | Status Change | By            |
| ---------- | --------------------------------- | ------------- | ------------- |
| 2026-03-23 | MVP Tracker created               | —             | Initial setup |
| 2026-03-23 | DEVOPS-1: Project Scaffolding     | BUILT         | @Suraj        |
| 2026-03-23 | AUTH-6.1: Authentication System   | BUILT         | @Suraj        |
| 2026-03-23 | DATA-5.1: Database Setup & Models | BUILT         | @Suraj        |
| 2026-03-23 | AI-7.1: LLM Orchestration Engine  | BUILT         | @Suraj        |
| 2026-03-23 | AI-7.2: Multi-Agent Framework     | BUILT         | @Suraj        |
| 2026-03-23 | AI-7.4: Prompt Management System  | BUILT         | @Suraj        |
| 2026-03-23 | DEVOPS-3: Docker Configuration    | BUILT         | @Pranishree   |
| 2026-03-24 | SHARED-1: Base Models & Schemas   | BUILT         | @Pranishree   |
| 2026-03-24 | SHARED-2: Common Middleware       | BUILT         | @Pranishree   |
| 2026-03-24 | OBS-6.18: Audit Logging System    | BUILT         | @Pranishree   |
| 2026-03-24 | OBS-6.19: Application Monitoring  | BUILT         | @Pranishree   |
| 2026-04-02 | AUTH-6.2: RBAC                    | BUILT         | @Keerthi      |
| 2026-04-02 | SEC-6.22: Security & Encryption   | BUILT         | @Keerthi      |
| 2026-04-02 | DATA-5.2: Vector Database Layer   | BUILT         | @Keerthi      |
| 2026-04-02 | DATA-5.6: File Storage Service    | BUILT         | @Keerthi      |
| 2026-04-02 | PLAT-6.26: Real-Time Engine       | BUILT         | @Keerthi      |
| 2026-04-02 | ANLY-6.22: Sentiment Analysis     | BUILT         | @Keerthi      |
| 2026-04-02 | NOTIF-6.7: Notification Engine    | BUILT         | @Keerthi      |
| 2026-04-02 | AI-7.5: Explainability Engine     | BUILT         | @Keerthi      |
| 2026-04-02 | AI-7.3: RAG Framework             | BUILT         | @Keerthi      |
| 2026-04-02 | DEPOT-V1: Camera Feed Integration | BUILT         | @Pranishree   |
| 2026-04-02 | DEPOT-V2: Bag/Box Detection       | BUILT         | @Pranishree   |
| 2026-04-02 | DEPOT-V7: Perimeter Monitoring    | BUILT         | @Pranishree   |
| 2026-04-02 | DEPOT-INV1: Inventory Core        | BUILT         | @Pranishree   |
| 2026-04-02 | UI-1: App Shell & Navigation      | BUILT         | @Keerthi      |
| 2026-04-02 | UI-2: Design System               | BUILT         | @Keerthi      |
| 2026-04-02 | STR-DASH: Stream Dashboard        | BUILT         | @Keerthi      |
| 2026-04-02 | ANLY-6.15: Predictive Analytics   | BUILT         | @Keerthi      |
| 2026-04-02 | DATA-5.4: Data Warehouse Connector| BUILT         | @Keerthi      |

---

_End of MVP Tracker. Keep this document updated. Push after every change._
