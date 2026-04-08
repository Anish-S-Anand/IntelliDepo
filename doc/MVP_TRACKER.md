# INTELLI PLATFORM — MVP DEVELOPMENT TRACKER

> **SINGLE SOURCE OF TRUTH** for the MVP sprint.
> Every developer and every Claude session MUST read this document before starting work.
> **MVP Scope**: Intelli Platform (minimal backend) + Intelli Stream (5 frontend-first features)
> Last updated: 2026-03-25

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
10. [5-Day Sprint Plan](#5-day-sprint-plan)
11. [Conflict Prevention Rules](#conflict-prevention-rules)

---

## HOW TO USE THIS DOCUMENT

### For Developers (Humans)

1. **Before starting work**: `git pull origin main` to get the latest version of this file
2. **Check today's assignment**: Find your name in the [Sprint Plan](#5-day-sprint-plan)
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

---

## FOR CLAUDE SESSIONS

> **Claude: Read this entire section before doing anything.**

You are being used by a developer to build a feature of the Intelli Platform MVP. Multiple developers are using separate Claude sessions simultaneously to build different features in parallel.

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
- Do NOT build Intelli Depot, Intelli Cafe, or Intelli Recruit features — they are **NOT in this MVP**
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

| ID | Name | Focus Area |
|----|------|------------|
| **@Chetan** | Developer 1 (Backend) | Data infrastructure, Stream backend APIs, sample data |
| **@Keerthi** | Developer 2 (Frontend) | Stream UI features, dashboards, responsive design |
| **@Suraj** | Developer 3 (Backend) | AI/Backend core, auth, RAG, Stream backend services |
| **@Pranishree** | Developer 4 (Frontend) | Stream UI features, auth pages, testing, polish |

### Sprint Duration

- **5 working days** (1 week)
- **Day 1-2**: Backend APIs + data layer for Stream features
- **Day 3-4**: Frontend builds all 5 Stream features in parallel with backend
- **Day 5**: Stream dashboard, integration testing, polish

---

## PROJECT OVERVIEW

**Intelli Platform** is Fidelis Digital's suite of AI-native enterprise products.

### MVP Products

| Product | Description | Target Users |
|---------|-------------|--------------|
| **Intelli Platform** | Minimal backend services (auth, AI, data) to support Stream | All products |
| **Intelli Stream™** | CFO intelligence & financial analytics suite (5 frontend-first features) | Finance, Treasury |

> **NOT in MVP**: Intelli Depot, Intelli Cafe, Intelli Recruit

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
- **NLP**: spaCy, Hugging Face Transformers

### Infrastructure
- **Database**: PostgreSQL 15+
- **Storage**: S3-compatible (MinIO for local dev)
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
├── doc/
│   └── MVP_TRACKER.md              ← THIS FILE
├── docker-compose.yml
├── .env.example
│
├── backend/
│   ├── app/
│   │   ├── main.py                 ← FastAPI app entry point
│   │   ├── config.py               ← Settings & env vars
│   │   ├── database.py             ← DB connection & session
│   │   │
│   │   ├── core/                   ← Shared platform services
│   │   │   ├── auth/               ← Authentication & authorization
│   │   │   ├── ai_orchestration/   ← AI Brain, LLM routing, agents, RAG
│   │   │   ├── notifications/      ← Notification engine
│   │   │   ├── analytics/          ← Sentiment analysis
│   │   │   ├── data_infra/         ← Vector DB, file storage
│   │   │   ├── observability/      ← Logging, monitoring
│   │   │   └── gateway/            ← Real-time engine
│   │   │
│   │   ├── stream/                 ← Intelli Stream product (MVP: 5 frontend-first)
│   │   │   ├── scenario/           ← What-if Simulations + Impact Sensitivity
│   │   │   ├── comptelens/         ← Peer Benchmarking + Earnings Transcript
│   │   │   ├── pulsemeter/         ← Revenue Concentration
│   │   │   └── data/               ← Sample data API
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
│   │   ├── app/                    ← React app root
│   │   ├── components/
│   │   │   ├── common/             ← Shared UI components
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
- `feature/core/vector-db`
- `feature/stream/what-if`
- `feature/stream/peer-benchmarking`

### Commit Message Format

```
<type>(<scope>): <description>

Types: feat, fix, refactor, test, docs, chore
Scope: core, stream, shared
```

---

## STATUS LEGEND

| Status | Meaning | Who Can Change It |
|--------|---------|-------------------|
| `OPEN` | Ready to be picked up, all dependencies are BUILT | Anyone (to BUILDING) |
| `BUILDING` | Someone is actively working on this | Only the assignee (to BUILT) |
| `BUILT` | Complete, tested, merged to main | No one (final state) |
| `BLOCKED` | Cannot start — dependencies not yet BUILT | Auto (when deps become BUILT → OPEN) |
| `DEFERRED` | Excluded from MVP — do not build | No one |

### Feature Line Format

```
- [STATUS] **ID: Feature Name** | Assignee: @name | Branch: feature/x/y | Deps: [A, B] | Day: N | Notes: ...
```

---

## FEATURE REGISTRY

> **IMPORTANT**: Before claiming a feature, always `git pull` and re-read this section.

### Feature Count Summary

| Category | BUILT | To Build | DEFERRED | Total |
|----------|:-----:|:--------:|:--------:|:-----:|
| Foundation (DevOps, Auth, DB, AI, Shared, Observability) | 22 | 0 | 2 | 24 |
| Frontend Shell | 2 | 2 | — | 4 |
| Stream Backend APIs | 2 | 1 | — | 3 |
| Stream Frontend Features | — | 6 | — | 6 |
| **TOTAL** | **26** | **9** | **2** | **37** |

> **MVP Build Scope: 35 features** (24 already built + 11 to build).
> All Depot features, most platform services, and non-essential infrastructure are deferred.
> Per Feature Independence Analysis: minimal backend + 5 frontend-first Stream features.

---

### ALREADY BUILT (Foundation)

These features are complete and available for all other features to depend on.

- [BUILT] **DEVOPS-1: Project Scaffolding** | Assignee: @Suraj | Deps: [None] | Notes: FastAPI backend, Next.js frontend, docker-compose, .env.example, Makefile
- [BUILT] **DEVOPS-3: Docker Configuration** | Assignee: @Pranishree | Deps: [DEVOPS-1] | Notes: Dockerfiles, docker-compose for local dev
- [BUILT] **AUTH-6.1: Authentication System** | Assignee: @Suraj | Deps: [None] | Notes: JWT auth, login/logout, password reset. Location: `backend/app/core/auth/`
- [BUILT] **AUTH-6.2: RBAC** | Assignee: @Suraj | Deps: [AUTH-6.1] | Notes: Roles, permissions, policy engine. Location: `backend/app/core/auth/rbac.py`
- [BUILT] **DATA-5.1: Database Setup & Models** | Assignee: @Suraj | Deps: [None] | Notes: PostgreSQL, SQLAlchemy, Alembic, connection pooling. Location: `backend/app/database.py`
- [BUILT] **DATA-5.2: Vector Database Layer** | Assignee: @Suraj | Deps: [None] | Notes: Pinecone impl, EmbeddingService, InMemory fallback, REST API. Location: `backend/app/core/data_infra/vector_db.py`
- [BUILT] **DATA-5.6: File Storage Service** | Assignee: @Suraj | Deps: [None] | Notes: S3/MinIO abstraction, upload/download/delete, presigned URLs. Location: `backend/app/core/data_infra/storage.py`
- [BUILT] **AI-7.1: LLM Orchestration Engine** | Assignee: @Suraj | Deps: [None] | Notes: Multi-model routing, fallback, cost tracking. Location: `backend/app/core/ai_orchestration/llm_engine.py`
- [BUILT] **AI-7.2: Multi-Agent Framework** | Assignee: @Suraj | Deps: [AI-7.1] | Notes: Agent lifecycle, task delegation, pipelines. Location: `backend/app/core/ai_orchestration/agent_framework.py`
- [BUILT] **AI-7.3: RAG Framework** | Assignee: @Suraj | Deps: [AI-7.1] | Notes: RAG pipeline, vector store interface, in-memory fallback. Location: `backend/app/core/ai_orchestration/rag/`
- [BUILT] **AI-7.4: Prompt Management System** | Assignee: @Suraj | Deps: [AI-7.1] | Notes: Prompt templates, versioning, A/B testing. Location: `backend/app/core/ai_orchestration/prompts/`
- [BUILT] **AI-7.5: Explainability Engine** | Assignee: @Suraj | Deps: [AI-7.1] | Notes: AI reasoning transparency, decision audit trails. Location: `backend/app/core/ai_orchestration/explainability.py`
- [BUILT] **ANLY-6.22: Sentiment Analysis** | Assignee: @Suraj | Deps: [AI-7.1] | Notes: Basic pos/neg/neutral, used by Earnings Transcript. Location: `backend/app/core/analytics/sentiment.py`
- [BUILT] **NOTIF-6.7: Notification Engine Core** | Assignee: @Suraj | Deps: [None] | Notes: Template system, delivery queue. Location: `backend/app/core/notifications/engine.py`
- [BUILT] **SEC-6.22: Security & Data Encryption** | Assignee: @Keerthi | Deps: [AUTH-6.1] | Notes: AES-256 at rest, TLS 1.3. Location: `backend/app/core/auth/encryption.py`
- [BUILT] **PLAT-6.26: Real-Time Engine** | Assignee: @Keerthi | Deps: [AUTH-6.1] | Notes: WebSocket, SSE, pub/sub. Location: `backend/app/core/gateway/realtime.py`
- [BUILT] **OBS-6.18: Audit Logging** | Assignee: @Pranishree | Deps: [AUTH-6.1] | Notes: Immutable audit trail. Location: `backend/app/core/observability/audit.py`
- [BUILT] **OBS-6.19: Application Monitoring** | Assignee: @Pranishree | Deps: [None] | Notes: Health checks, metrics. Location: `backend/app/core/observability/monitoring.py`
- [BUILT] **SHARED-1: Base Models & Schemas** | Assignee: @Pranishree | Deps: [DATA-5.1] | Notes: Pydantic schemas, SQLAlchemy mixins. Location: `backend/app/shared/`
- [BUILT] **SHARED-2: Common Middleware** | Assignee: @Pranishree | Deps: [AUTH-6.1] | Notes: CORS, request ID, rate limiting. Location: `backend/app/shared/middleware/`
- [BUILT] **UI-1: App Shell & Navigation** | Assignee: @Keerthi | Deps: [None] | Notes: Main layout, sidebar, header, responsive. Location: `frontend/src/app/`
- [BUILT] **UI-2: Design System & Component Library** | Assignee: @Keerthi | Deps: [None] | Notes: Tailwind + shadcn/ui setup. Location: `frontend/src/components/ui/`

> **Also built but deferred from MVP scope** (Depot features — code exists but not part of MVP demo):
> DEPOT-V1: Camera Feed, DEPOT-V2: Bag/Box Detection, DEPOT-V7: Perimeter Monitoring, DEPOT-INV1: Inventory Core

- [DEFERRED] ~~AUTH-6.3: SSO Integration~~ — Not in MVP
- [DEFERRED] ~~AUTH-6.4: Multi-Tenant & White Labeling~~ — Not in MVP

---

### TO BUILD — STREAM BACKEND APIs (@Suraj, @Chetan)

> Only the backend services needed to support the 5 Stream frontend features.
> Per Feature Independence Analysis: Auth ✅, RBAC ✅, Vector DB ✅, File Storage ✅.

- [BUILT] **STR-API-1: Stream Sample Data API** | Assignee: @claude | Branch: feature/stream/sample-data-api | Deps: [AUTH-6.1, DATA-5.1] | Day: 1-2 | Notes: REST API serving sample financial data for Peer Benchmarking + Revenue Concentration. Pre-load 5-8 company financials and 10-15 client portfolio as JSON/DB seed. Location: `backend/app/stream/data/sample_data_api.py`
- [BUILT] **STR-API-2: Scenario Engine Backend** | Assignee: @Suraj | Branch: feature/stream/scenario-engine | Deps: [DATA-5.1] | Day: 2 | Notes: CRUD for scenarios + sensitivity configs, clone, baseline seeder, 11 tests passing. Location: `backend/app/stream/scenario/api.py`
- [BUILT] **STR-API-3: Earnings Transcript Backend** | Assignee: @Suraj | Branch: feature/stream/earnings-transcript | Deps: [AI-7.3, DATA-5.2] | Day: 2-3 | Notes: NLP pipeline — sentiment timeline, metrics extraction, risk flags, management tone, RAG ingestion, competitive comparison, 5 sample transcripts, 28 tests passing. Location: `backend/app/stream/competelens/earnings_api.py`

---

### TO BUILD — FRONTEND UI (@Keerthi, @Pranishree)

#### Auth & Common Pages

- [OPEN] **UI-3: Login & Auth Pages** | Assignee: — | Branch: — | Deps: [AUTH-6.1, UI-1] | Day: 1 | Notes: Login, register, forgot password pages. Location: `frontend/src/app/auth/`
- [OPEN] **UI-4: User Profile & Settings** | Assignee: — | Branch: — | Deps: [AUTH-6.2, UI-1] | Day: 2 | Notes: Profile page, preferences. Location: `frontend/src/app/settings/`

#### Intelli Stream — 5 Frontend Features

> **Strategy**: Frontend-first with static/sample data. Backend APIs provide data, but UI can work with hardcoded fallbacks during development.

- [OPEN] **STR-WIF: What-if Simulations** | Assignee: — | Branch: — | Deps: [UI-1, UI-2] | Day: 2-3 | Notes: 100% frontend — sliders adjust financial variables (Revenue, COGS, OpEx, EBITDA), split-view comparison, delta highlights. Hardcode a base financial model. Location: `frontend/src/components/stream/scenario/WhatIfSimulator.tsx`
- [BLOCKED] **STR-ISM: Impact Sensitivity Mapping** | Assignee: — | Branch: — | Deps: [STR-WIF] | Day: 3 | Notes: Tornado charts, driver ranking bars, threshold indicators. Shares What-if data model. Location: `frontend/src/components/stream/scenario/SensitivityMap.tsx`
- [OPEN] **STR-PB: Peer Benchmarking** | Assignee: — | Branch: — | Deps: [UI-1, UI-2] | Day: 2-3 | Notes: KPI comparison tables, radar charts, gap analysis bars, peer group selector. Use sample JSON data (5-8 companies). Location: `frontend/src/components/stream/comptelens/PeerBenchmark.tsx`
- [OPEN] **STR-RC: Revenue Concentration** | Assignee: — | Branch: — | Deps: [UI-1, UI-2] | Day: 2-3 | Notes: Donut/pie charts, Herfindahl index card, client table, risk heat bands. Sample portfolio 10-15 clients. Location: `frontend/src/components/stream/pulsemeter/RevenueConcentration.tsx`
- [BLOCKED] **STR-ETA: Earnings Transcript Analysis** | Assignee: — | Branch: — | Deps: [STR-API-3, STR-PB] | Day: 3-4 | Notes: Document viewer, key theme cards, sentiment timeline. Use pre-processed sample transcripts. Location: `frontend/src/components/stream/comptelens/EarningsAnalysis.tsx`

#### Stream Dashboard

- [BLOCKED] **STR-DASH: Stream Dashboard** | Assignee: — | Branch: — | Deps: [STR-WIF, STR-PB, STR-RC] | Day: 4-5 | Notes: Unified Stream dashboard with navigation across all 5 features. Location: `frontend/src/components/stream/dashboard/`

---

### DEFERRED FEATURES (Not in MVP)

> **Claude: Do NOT build any of these features.**

#### Deferred — Intelli Platform (not needed for Stream MVP)
- ~~GW-6.5: API Gateway~~
- ~~NOTIF-6.12: In-App Notifications~~
- ~~ANLY-6.15: Predictive Analytics Engine~~
- ~~ANLY-6.16: Simulation Engine~~
- ~~ANLY-6.17: Executive Dashboards~~
- ~~ANLY-6.23: ROI & Performance Tracking~~
- ~~ANLY-6.24: Report Generation Engine~~
- ~~ANLY-6.25: Orchestrator Agent~~
- ~~OBS-6.20: SLA Monitoring~~
- ~~PLAT-6.23: No-Code Engine~~
- ~~PLAT-6.25: Modular Architecture~~
- ~~AI-MODEL: AI Model Management~~
- ~~WF-6.13: Workflow Automation~~
- ~~DATA-5.4: Data Warehouse Connector~~
- ~~INT-4.1: Enterprise Data Connectors~~
- ~~SHARED-3: Multi-Language Support~~

#### Deferred — Intelli Depot (entire product)
- ~~All Depot features (Vision, Operations, Inventory, Command, Analytics, Orchestrator, Dashboard)~~
- ~~Code exists for V1, V2, V7, INV1 but excluded from MVP demo~~

#### Deferred — Intelli Stream (everything except the 5 MVP picks)
- ~~MacroPulse (Interest Rates, FX, Commodity)~~
- ~~RiskRadar (Credit Rating, Distress)~~
- ~~GeoRisk, SLA Monitor, Churn Guard, CLV Tracker~~
- ~~Forecasting Engine, CFO Brief, Real-Time Alerts~~
- ~~CFO Orchestrator, Audit & Governance~~

#### Deferred — Products
- ~~Intelli Cafe (entire product)~~
- ~~Intelli Recruit (entire product)~~

---

## 5-DAY SPRINT PLAN

> **Backend** (@Suraj, @Chetan): Build minimal APIs + sample data to power the frontend.
> **Frontend** (@Keerthi, @Pranishree): Build all 5 Stream features + auth pages + dashboard.
> Frontend can start Day 1 with hardcoded data, connect to APIs as they're ready.

#### Day 1 (Wed Mar 25) — Auth Pages + Data APIs Start

| Developer | Feature(s) | Notes |
|-----------|-----------|-------|
| **@Suraj** | STR-API-1: Sample Data API | REST endpoints serving sample financial data for Peer Benchmarking + Revenue Concentration. Seed DB with sample companies + client portfolio. |
| **@Chetan** | STR-API-2: Scenario Backend | Thin persistence API for What-if scenarios. |
| **@Keerthi** | UI-3: Login & Auth Pages | Login, register, forgot password. Uses AUTH-6.1 ✅. |
| **@Pranishree** | STR-WIF: What-if Simulations (start) | 100% frontend. Sliders + financial model + split-view. Can start with hardcoded model. |

#### Day 2 (Thu Mar 26) — Backend APIs + Frontend Features

| Developer | Feature(s) | Notes |
|-----------|-----------|-------|
| **@Suraj** | STR-API-3: Earnings Transcript Backend | NLP pipeline via RAG (AI-7.3 ✅). Pre-process 3-5 sample transcripts. |
| **@Chetan** | UI-4: User Profile + help with sample data seeding | Profile page + ensure sample data is demo-ready. |
| **@Keerthi** | STR-PB: Peer Benchmarking | KPI tables, radar charts, gap analysis. Use sample JSON until API ready. |
| **@Pranishree** | STR-WIF (finish) + STR-RC: Revenue Concentration | Finish What-if sliders. Start pie charts + Herfindahl index. |

#### Day 3 (Fri Mar 27) — All Features In Progress

| Developer | Feature(s) | Notes |
|-----------|-----------|-------|
| **@Suraj** | API bug fixes + integration support | Fix any API issues frontend discovers. |
| **@Chetan** | Connect frontend features to backend APIs | Help frontend devs wire up API calls, fix data format issues. |
| **@Keerthi** | STR-ISM: Impact Sensitivity Mapping | Tornado charts, pairs with What-if (Day 1-2). |
| **@Pranishree** | STR-RC (finish) + STR-ETA: Earnings Transcript Analysis (start) | Document viewer, theme cards, sentiment timeline. |

#### Day 4 (Mon Mar 31) — Dashboard + Integration

| Developer | Feature(s) | Notes |
|-----------|-----------|-------|
| **@Suraj** | API polish + integration testing | Ensure all endpoints work end-to-end. |
| **@Chetan** | STR-DASH: Stream Dashboard | Unified dashboard integrating all 5 features with navigation. |
| **@Keerthi** | STR-ETA (finish) + connect all features to live APIs | Replace hardcoded data with API calls. |
| **@Pranishree** | STR-DASH: Stream Dashboard (with Chetan) | Help build dashboard + test all feature integrations. |

#### Day 5 (Tue Apr 1) — Polish, Testing, Demo Prep

| Developer | Feature(s) | Notes |
|-----------|-----------|-------|
| **@Suraj** | End-to-end testing backend + API documentation | Ensure all endpoints work, OpenAPI docs complete. |
| **@Chetan** | Sample data validation + edge case testing | Verify all demo data looks realistic and correct. |
| **@Keerthi** | Responsive/mobile testing + UI polish | All features work on mobile. Loading states, error states. |
| **@Pranishree** | Full E2E testing + demo walkthrough script | Test every user flow. Prepare demo talking points. |

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

## QUICK REFERENCE: WHAT CAN BE BUILT NOW

| Feature ID | Feature Name | Day | Assignee | Team |
|-----------|-------------|-----|----------|------|
| STR-API-1 | Sample Data API | 1 | @Suraj | Backend |
| STR-API-2 | Scenario Backend | 1 | @Chetan | Backend |
| STR-API-3 | Earnings Transcript Backend | 2 | @Suraj | Backend |
| UI-3 | Login & Auth Pages | 1 | @Keerthi | Frontend |
| UI-4 | User Profile | 2 | @Chetan | Frontend |
| STR-WIF | What-if Simulations | 1-2 | @Pranishree | Frontend |
| STR-PB | Peer Benchmarking | 2-3 | @Keerthi | Frontend |
| STR-RC | Revenue Concentration | 2-3 | @Pranishree | Frontend |

---

## CHANGELOG

| Date | Feature | Status Change | By |
|------|---------|--------------|-----|
| 2026-03-23 | Foundation features (DEVOPS-1, AUTH-6.1, DATA-5.1, AI-7.1/7.2/7.4) | BUILT | @Suraj |
| 2026-03-24 | DEVOPS-3, SHARED-1/2, OBS-6.18/6.19 | BUILT | @Pranishree |
| 2026-03-24 | AUTH-6.2, AI-7.3/7.5, NOTIF-6.7, ANLY-6.22 | BUILT | @Suraj |
| 2026-03-24 | UI-1, UI-2, SEC-6.22, PLAT-6.26 | BUILT | @Keerthi |
| 2026-03-25 | DATA-5.2: Vector DB, DATA-5.6: File Storage | BUILT | @Suraj |
| 2026-03-25 | **MVP SCOPE CHANGE**: Dropped Depot + most platform services. Focused on 5 frontend-first Stream features + minimal backend per Feature Independence Analysis. Sprint: 5 days. | SCOPE CHANGE | @Suraj |
| 2026-03-25 | STR-API-1: Stream Sample Data API | BUILT | @claude |
| 2026-03-25 | STR-API-2: Scenario Engine Backend | BUILT | @Suraj |

---

*End of MVP Tracker. Keep this document updated. Push after every change.*
