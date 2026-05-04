"""Generate a presentable MVP Plan of Action document."""

from docx import Document
from docx.shared import Inches, Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

doc = Document()

# ── Styles ──────────────────────────────────────────────────────────
style = doc.styles["Normal"]
font = style.font
font.name = "Calibri"
font.size = Pt(11)
font.color.rgb = RGBColor(0x33, 0x33, 0x33)
style.paragraph_format.space_after = Pt(6)
style.paragraph_format.line_spacing = 1.15

for level in range(1, 4):
    h = doc.styles[f"Heading {level}"]
    h.font.name = "Calibri"
    h.font.color.rgb = RGBColor(0x1A, 0x3C, 0x6E)  # dark navy
    if level == 1:
        h.font.size = Pt(22)
        h.paragraph_format.space_before = Pt(24)
        h.paragraph_format.space_after = Pt(12)
    elif level == 2:
        h.font.size = Pt(16)
        h.paragraph_format.space_before = Pt(18)
        h.paragraph_format.space_after = Pt(8)
    else:
        h.font.size = Pt(13)
        h.paragraph_format.space_before = Pt(12)
        h.paragraph_format.space_after = Pt(6)


def set_cell_shading(cell, color_hex):
    """Set cell background color."""
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shading = OxmlElement("w:shd")
    shading.set(qn("w:fill"), color_hex)
    shading.set(qn("w:val"), "clear")
    tcPr.append(shading)


def make_table(doc, headers, rows, col_widths=None, header_color="1A3C6E"):
    """Create a styled table."""
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.style = "Table Grid"

    # Header row
    for i, h in enumerate(headers):
        cell = table.rows[0].cells[i]
        cell.text = ""
        p = cell.paragraphs[0]
        run = p.add_run(h)
        run.bold = True
        run.font.size = Pt(10)
        run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        run.font.name = "Calibri"
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        set_cell_shading(cell, header_color)

    # Data rows
    for r_idx, row in enumerate(rows):
        for c_idx, val in enumerate(row):
            cell = table.rows[r_idx + 1].cells[c_idx]
            cell.text = ""
            p = cell.paragraphs[0]
            run = p.add_run(str(val))
            run.font.size = Pt(10)
            run.font.name = "Calibri"
            if r_idx % 2 == 1:
                set_cell_shading(cell, "F0F4FA")

    if col_widths:
        for i, w in enumerate(col_widths):
            for row in table.rows:
                row.cells[i].width = Cm(w)

    doc.add_paragraph("")  # spacer
    return table


def add_bullet(doc, text, bold_prefix=None, level=0):
    p = doc.add_paragraph(style="List Bullet")
    p.paragraph_format.left_indent = Cm(1.2 + level * 0.8)
    if bold_prefix:
        run = p.add_run(bold_prefix)
        run.bold = True
        run.font.size = Pt(11)
        run.font.name = "Calibri"
        run2 = p.add_run(text)
        run2.font.size = Pt(11)
        run2.font.name = "Calibri"
    else:
        run = p.add_run(text)
        run.font.size = Pt(11)
        run.font.name = "Calibri"


# ══════════════════════════════════════════════════════════════════════
# COVER / TITLE
# ══════════════════════════════════════════════════════════════════════

for _ in range(6):
    doc.add_paragraph("")

title = doc.add_paragraph()
title.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = title.add_run("INTELLI PLATFORM")
run.bold = True
run.font.size = Pt(36)
run.font.color.rgb = RGBColor(0x1A, 0x3C, 0x6E)
run.font.name = "Calibri"

subtitle = doc.add_paragraph()
subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = subtitle.add_run("MVP Plan of Action")
run.font.size = Pt(22)
run.font.color.rgb = RGBColor(0x4A, 0x6F, 0xA5)
run.font.name = "Calibri"

doc.add_paragraph("")

line = doc.add_paragraph()
line.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = line.add_run("━" * 40)
run.font.color.rgb = RGBColor(0xCC, 0xCC, 0xCC)

doc.add_paragraph("")

meta = doc.add_paragraph()
meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = meta.add_run("Fidelis Digital  •  2-Week Sprint  •  4 Developers\n64 Features  •  3 Products")
run.font.size = Pt(13)
run.font.color.rgb = RGBColor(0x66, 0x66, 0x66)
run.font.name = "Calibri"

doc.add_paragraph("")
meta2 = doc.add_paragraph()
meta2.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = meta2.add_run("March 2026")
run.font.size = Pt(12)
run.font.color.rgb = RGBColor(0x99, 0x99, 0x99)
run.font.name = "Calibri"

doc.add_page_break()

# ══════════════════════════════════════════════════════════════════════
# 1. PROJECT OVERVIEW
# ══════════════════════════════════════════════════════════════════════

doc.add_heading("1. Project Overview", level=1)

doc.add_paragraph(
    "Intelli Platform is Fidelis Digital's suite of AI-native enterprise products. "
    "The MVP sprint delivers the shared platform core along with two product verticals — "
    "Intelli Depot (warehouse & logistics) and a focused slice of Intelli Stream (financial intelligence)."
)

doc.add_heading("MVP Products", level=2)

make_table(doc,
    ["Product", "Description", "Target Users"],
    [
        ["Intelli Platform (Core)", "Shared services — Auth, AI, Data, Notifications, Observability", "All products"],
        ["Intelli Depot™", "AI-powered warehouse & logistics management with computer vision", "Warehouse Operations"],
        ["Intelli Stream™", "CFO intelligence — Credit Rating + Distress Probability only", "Finance & Treasury"],
    ],
    col_widths=[4.5, 8, 4]
)

p = doc.add_paragraph()
run = p.add_run("Not in MVP: ")
run.bold = True
run.font.size = Pt(11)
run = p.add_run("Intelli Cafe, Intelli Recruit — deferred to post-MVP.")
run.font.size = Pt(11)

# ══════════════════════════════════════════════════════════════════════
# 2. ARCHITECTURE
# ══════════════════════════════════════════════════════════════════════

doc.add_heading("2. Architecture — 7-Layer Model", level=1)

doc.add_paragraph(
    "The platform follows a layered architecture built top-down. "
    "Higher layers (AI, Platform Services) are built first so product-specific features can leverage them."
)

make_table(doc,
    ["Layer", "Name", "What It Contains"],
    [
        ["7", "AI Orchestration Brain", "LLM routing, multi-agent framework, RAG, prompt management, explainability"],
        ["6", "Common Platform Services", "Auth/RBAC, API Gateway, Notifications, Analytics, Observability, Real-Time"],
        ["5", "Data Infrastructure", "Database, Vector DB, File Storage, Data Warehouse connectors"],
        ["4", "Integration Layer", "Enterprise connectors (REST APIs, webhooks, circuit breakers)"],
        ["3", "Command / Operations", "Product-specific business logic (Depot Command, Stream RiskRadar)"],
        ["2", "Module-Specific Features", "Vision, Inventory, Operations, Orchestrator"],
        ["1", "User Experience", "Dashboards, UI components, mobile-responsive design"],
    ],
    col_widths=[1.5, 4.5, 10.5]
)

p = doc.add_paragraph()
run = p.add_run("Build order: ")
run.bold = True
run.font.size = Pt(11)
run = p.add_run("Layers 7 → 6 → 5 → 4 (foundation first), then product features (Layers 3–1) in parallel.")
run.font.size = Pt(11)

# ══════════════════════════════════════════════════════════════════════
# 3. TEAM
# ══════════════════════════════════════════════════════════════════════

doc.add_heading("3. Team & Responsibilities", level=1)

make_table(doc,
    ["Developer", "Focus Area", "Key Deliverables"],
    [
        ["@Suraj", "AI / Backend Core", "AI Orchestration, RBAC, Notifications, Stream, Depot Vision"],
        ["@Chetan", "Data & Analytics", "Data infrastructure, Analytics engines, Gateway, Depot Command"],
        ["@Keerthi", "Frontend & UX", "UI shell, Dashboards, Real-Time Engine, Security"],
        ["@Pranishree", "Ops & Quality", "Observability, Shared utilities, Depot Operations, Testing"],
    ],
    col_widths=[3, 4, 9.5]
)

# ══════════════════════════════════════════════════════════════════════
# 4. FEATURE BREAKDOWN BY CATEGORY
# ══════════════════════════════════════════════════════════════════════

doc.add_heading("4. Feature Breakdown by Category", level=1)

doc.add_paragraph(
    "The MVP consists of 64 features (6 already built, 58 to build) organized across 9 categories."
)

make_table(doc,
    ["Category", "Built", "To Build", "Total"],
    [
        ["DevOps & Foundation", "1", "1", "2"],
        ["AI Orchestration (Layer 7)", "3", "2", "5"],
        ["Platform Services (Layer 6)", "1", "20", "21"],
        ["Data Infrastructure (Layer 5)", "1", "3", "4"],
        ["Integration (Layer 4)", "—", "1", "1"],
        ["Shared Utilities", "—", "3", "3"],
        ["Frontend UI", "—", "4", "4"],
        ["Intelli Depot", "—", "21", "21"],
        ["Intelli Stream", "—", "3", "3"],
        ["TOTAL", "6", "58", "64"],
    ],
    col_widths=[5, 2.5, 2.5, 2.5]
)

# Feature list by category
doc.add_heading("AI Orchestration (Layer 7)", level=3)
for item in [
    ("AI-7.1: ", "LLM Orchestration Engine — multi-model routing, fallback, cost tracking"),
    ("AI-7.2: ", "Multi-Agent Framework — agent lifecycle, task delegation, pipelines"),
    ("AI-7.3: ", "RAG Framework — vector DB integration, chunking, embedding pipeline"),
    ("AI-7.4: ", "Prompt Management — templates, versioning, A/B testing"),
    ("AI-7.5: ", "Explainability Engine — decision audit trails, confidence scoring"),
]:
    add_bullet(doc, item[1], item[0])

doc.add_heading("Platform Services (Layer 6)", level=3)

doc.add_heading("Auth & Security", level=3)
for item in [
    ("AUTH-6.1: ", "Authentication System — JWT, login/logout, sessions"),
    ("AUTH-6.2: ", "RBAC — Roles, permissions, policy engine, multi-tenant"),
    ("SEC-6.22: ", "Security & Encryption — AES-256 at rest, TLS 1.3, key rotation"),
]:
    add_bullet(doc, item[1], item[0])

doc.add_heading("API & Platform Infrastructure", level=3)
for item in [
    ("GW-6.5: ", "Unified API Gateway — rate limiting, routing, versioning, logging"),
    ("PLAT-6.25: ", "Modular Architecture — module registry, feature toggles, dependency mapping"),
    ("PLAT-6.26: ", "Real-Time Engine — WebSocket, SSE, pub/sub, auto-reconnect"),
    ("PLAT-6.23: ", "No-Code Configuration Engine — rules engine, configurable thresholds"),
]:
    add_bullet(doc, item[1], item[0])

doc.add_heading("Notifications", level=3)
for item in [
    ("NOTIF-6.7: ", "Notification Engine Core — templates, delivery queue, retry, tracking"),
    ("NOTIF-6.12: ", "In-App Notifications — WebSocket real-time, notification center"),
]:
    add_bullet(doc, item[1], item[0])

doc.add_heading("Analytics & Intelligence", level=3)
for item in [
    ("ANLY-6.15: ", "Predictive Analytics Engine — forecasting, trend & anomaly detection"),
    ("ANLY-6.16: ", "Simulation Engine — what-if scenarios, Monte Carlo, sensitivity analysis"),
    ("ANLY-6.17: ", "Executive Dashboards — configurable widgets, real-time data, export"),
    ("ANLY-6.22: ", "Sentiment Analysis — basic positive/negative/neutral (MVP scope)"),
    ("ANLY-6.23: ", "ROI & Performance Tracking — basic KPI cards (MVP scope)"),
    ("ANLY-6.24: ", "Report Generation — PDF export, 1 template (MVP scope)"),
    ("ANLY-6.25: ", "Orchestrator Agent — cross-domain insights, priority arbitration"),
    ("AI-MODEL: ", "AI Model Management — model registry listing (MVP scope)"),
]:
    add_bullet(doc, item[1], item[0])

doc.add_heading("Observability", level=3)
for item in [
    ("OBS-6.18: ", "Audit Logging — immutable audit trail, compliance reporting"),
    ("OBS-6.19: ", "Application Monitoring — health checks, metrics, alerting, tracing"),
    ("OBS-6.20: ", "SLA Monitoring — performance tracking, breach prediction"),
]:
    add_bullet(doc, item[1], item[0])

doc.add_heading("Data Infrastructure (Layer 5)", level=3)
for item in [
    ("DATA-5.1: ", "Database Setup — PostgreSQL, SQLAlchemy, Alembic, connection pooling"),
    ("DATA-5.2: ", "Vector Database Layer — Pinecone/Weaviate, semantic search API"),
    ("DATA-5.4: ", "Data Warehouse Connector — Snowflake/BigQuery, data sync"),
    ("DATA-5.6: ", "File Storage Service — S3/MinIO abstraction, presigned URLs"),
]:
    add_bullet(doc, item[1], item[0])

doc.add_heading("Integration (Layer 4)", level=3)
add_bullet(doc, "Enterprise Data Connectors — REST API framework, webhooks, circuit breaker", "INT-4.1: ")

doc.add_heading("Shared Utilities & Frontend", level=3)
for item in [
    ("SHARED-1: ", "Base Models & Schemas — Pydantic schemas, SQLAlchemy mixins, pagination"),
    ("SHARED-2: ", "Common Middleware — CORS, request ID, rate limiting, error handling"),
    ("SHARED-3: ", "Multi-Language Support — English + Arabic UI labels (MVP scope)"),
    ("UI-1: ", "App Shell & Navigation — layout, sidebar, header, product switcher"),
    ("UI-2: ", "Design System — Tailwind + shadcn/ui, theme, common components"),
    ("UI-3: ", "Login & Auth Pages — login, register, forgot password, MFA"),
    ("UI-4: ", "User Profile & Settings — profile page, preferences, notifications"),
]:
    add_bullet(doc, item[1], item[0])

doc.add_page_break()

doc.add_heading("Intelli Depot — 21 Features", level=3)

doc.add_paragraph("IntelliVision (Computer Vision):", style="Normal").runs[0].bold = True
for item in [
    ("DEPOT-V1: ", "Camera Feed Integration — RTSP/IP streams, frame extraction"),
    ("DEPOT-V2: ", "Bag/Box Detection — YOLO v8 detection, counting, size estimation"),
    ("DEPOT-V3: ", "Automated Counting — real-time tally, discrepancy alerts"),
    ("DEPOT-V4: ", "Cluster Mapping — space heatmap, occupancy, zone management"),
    ("DEPOT-V5: ", "FIFO/FILO/LIFO Logic — stack ordering, age-based prioritization"),
    ("DEPOT-V7: ", "Perimeter Monitoring — breach detection, unauthorized access alerts"),
]:
    add_bullet(doc, item[1], item[0])

doc.add_paragraph("Inventory & Operations:", style="Normal").runs[0].bold = True
for item in [
    ("DEPOT-INV1: ", "Inventory Management Core — SKU, stock levels, barcode/QR"),
    ("DEPOT-OPS1: ", "Task Assignment — manual assignment with priority queue (MVP)"),
    ("DEPOT-OPS2: ", "Guided Checklists — static templates, completion tracking (MVP)"),
]:
    add_bullet(doc, item[1], item[0])

doc.add_paragraph("Command Layer:", style="Normal").runs[0].bold = True
for item in [
    ("DEPOT-CMD1: ", "Live Monitoring — multi-feed dashboard, threshold alerts"),
    ("DEPOT-CMD2: ", "Fleet & Yard View — fleet tracking, yard slots, dwell time"),
    ("DEPOT-CMD3: ", "Incident Escalation — auto-escalation, severity, multi-channel alerts"),
    ("DEPOT-CMD4: ", "SLA Tracking — breach prediction, performance scoring"),
]:
    add_bullet(doc, item[1], item[0])

doc.add_paragraph("Analytics & Orchestrator:", style="Normal").runs[0].bold = True
for item in [
    ("DEPOT-ANLY1: ", "Operational KPIs — throughput, utilization, cost-per-unit"),
    ("DEPOT-ANLY3: ", "RBAC & Audit Logs — depot-specific access, tamper-proof trails"),
    ("DEPOT-ANLY-AD: ", "Anomaly Detection — operations anomalies, fraud detection"),
    ("DEPOT-INT3: ", "API Health Monitoring — health checks, latency, error rate"),
    ("DEPOT-ORCH1: ", "Cross-Module Optimization — multi-objective, recommendations"),
    ("DEPOT-ORCH2: ", "Scenario Simulation — variable adjustment, impact visualization"),
    ("DEPOT-ORCH-RL: ", "Revenue Leakage Detection — root cause, recovery recommendations"),
]:
    add_bullet(doc, item[1], item[0])

doc.add_paragraph("Dashboard:", style="Normal").runs[0].bold = True
add_bullet(doc, "Warehouse Dashboard — real-time overview, KPIs, alerts", "DEPOT-DASH1: ")

doc.add_heading("Intelli Stream — 3 Features (MVP Slice)", level=3)
for item in [
    ("STR-RR1: ", "Credit Rating Monitoring — tracking, alerts, counterparty exposure"),
    ("STR-RR2: ", "Distress Probability — Z-score, cash flow stress testing, default probability"),
    ("STR-DASH: ", "Stream Dashboard — credit rating + distress probability view"),
]:
    add_bullet(doc, item[1], item[0])

doc.add_page_break()

# ══════════════════════════════════════════════════════════════════════
# 5. DAY-BY-DAY SPRINT PLAN
# ══════════════════════════════════════════════════════════════════════

doc.add_heading("5. Day-by-Day Sprint Plan", level=1)

doc.add_paragraph(
    "The 2-week sprint (10 working days) is structured so that foundation layers are built first, "
    "unlocking product-specific features in parallel during the second half."
)

# Week 1 header
doc.add_heading("WEEK 1 — Foundation & Core Services", level=2)

# Day 1
doc.add_heading("Day 1 (Monday) — Foundation Sprint", level=3)
make_table(doc,
    ["Developer", "Feature(s)", "Details"],
    [
        ["@Suraj", "AUTH-6.2: RBAC", "Roles, permissions, policy engine — many features depend on this"],
        ["@Chetan", "DATA-5.2: Vector DB\nDATA-5.6: File Storage", "Both have no dependencies, start immediately"],
        ["@Keerthi", "UI-1: App Shell\nUI-2: Design System", "Frontend foundation — layout, sidebar, components"],
        ["@Pranishree", "SHARED-1: Base Models\nSHARED-2: Middleware\nDEVOPS-3: Docker", "Shared utilities + Docker local dev setup"],
    ],
    col_widths=[3, 4.5, 9]
)

# Day 2
doc.add_heading("Day 2 (Tuesday) — Core Services", level=3)
make_table(doc,
    ["Developer", "Feature(s)", "Details"],
    [
        ["@Suraj", "AI-7.5: Explainability\nAI-7.3: RAG (start)", "XAI engine + begin RAG framework"],
        ["@Chetan", "GW-6.5: API Gateway\nPLAT-6.25: Modular Architecture", "Gateway routing + module registry"],
        ["@Keerthi", "PLAT-6.26: Real-Time Engine\nSEC-6.22: Security", "WebSocket/SSE + encryption layer"],
        ["@Pranishree", "OBS-6.18: Audit Logging\nOBS-6.19: App Monitoring", "Full observability stack"],
    ],
    col_widths=[3, 4.5, 9]
)

# Day 3
doc.add_heading("Day 3 (Wednesday) — Analytics Foundation + Depot Start", level=3)
make_table(doc,
    ["Developer", "Feature(s)", "Details"],
    [
        ["@Suraj", "AI-7.3: RAG (finish)\nNOTIF-6.7: Notifications", "Complete RAG + notification engine"],
        ["@Chetan", "ANLY-6.15: Predictive Analytics\nDATA-5.4: DW Connector", "Analytics engine foundation"],
        ["@Keerthi", "UI-3: Login Pages\nANLY-6.17: Dashboards (start)", "Auth UI + dashboard framework"],
        ["@Pranishree", "DEPOT-V1: Camera Feed\nDEPOT-INV1: Inventory Core", "Depot product begins!"],
    ],
    col_widths=[3, 4.5, 9]
)

# Day 4
doc.add_heading("Day 4 (Thursday) — Analytics + Depot Vision", level=3)
make_table(doc,
    ["Developer", "Feature(s)", "Details"],
    [
        ["@Suraj", "NOTIF-6.12: In-App Notifications\nANLY-6.22: Sentiment", "Real-time notifications + basic sentiment"],
        ["@Chetan", "ANLY-6.16: Simulation Engine\nINT-4.1: Enterprise Connectors", "What-if scenarios + API connector framework"],
        ["@Keerthi", "ANLY-6.17: Dashboards (finish)\nUI-4: User Profile", "Complete dashboards + profile pages"],
        ["@Pranishree", "DEPOT-V2: Bag/Box Detection\nDEPOT-V7: Perimeter", "YOLO model setup — full day focus"],
    ],
    col_widths=[3, 4.5, 9]
)

# Day 5
doc.add_heading("Day 5 (Friday) — Depot Operations + Platform", level=3)
make_table(doc,
    ["Developer", "Feature(s)", "Details"],
    [
        ["@Suraj", "ANLY-6.25: Orchestrator Agent\nAI-MODEL: Model Mgmt", "Central coordination + model registry"],
        ["@Chetan", "ANLY-6.23: ROI Tracking\nANLY-6.24: Reports", "KPI cards + PDF report export"],
        ["@Keerthi", "PLAT-6.23: No-Code Engine\nDEPOT-INT3: API Health", "Configuration engine + API monitoring"],
        ["@Pranishree", "DEPOT-OPS1: Task Assignment\nDEPOT-OPS2: Checklists\nOBS-6.20: SLA Monitoring", "Depot operations + SLA monitoring"],
    ],
    col_widths=[3, 4.5, 9]
)

doc.add_page_break()

# Week 2 header
doc.add_heading("WEEK 2 — Product Features, Integration & Polish", level=2)

# Day 6
doc.add_heading("Day 6 (Monday) — Depot Command Layer", level=3)
make_table(doc,
    ["Developer", "Feature(s)", "Details"],
    [
        ["@Suraj", "DEPOT-V4: Cluster Mapping\nDEPOT-V5: FIFO/LIFO (start)", "Space heatmap + stack ordering rules"],
        ["@Chetan", "DEPOT-CMD1: Live Monitoring\nDEPOT-CMD3: Escalation\nDEPOT-CMD4: SLA Tracking", "Full command layer"],
        ["@Keerthi", "DEPOT-DASH1: Warehouse Dashboard\nDEPOT-CMD2: Fleet & Yard", "Depot UI + fleet management"],
        ["@Pranishree", "DEPOT-V3: Counting\nDEPOT-ANLY3: Audit\nSHARED-3: i18n", "Counting + audit trails + EN/AR support"],
    ],
    col_widths=[3, 4.5, 9]
)

# Day 7
doc.add_heading("Day 7 (Tuesday) — Depot Analytics + Stream Start", level=3)
make_table(doc,
    ["Developer", "Feature(s)", "Details"],
    [
        ["@Suraj", "DEPOT-V5: FIFO/LIFO (finish)\nSTR-RR1: Credit Rating", "Complete vision + Stream begins!"],
        ["@Chetan", "DEPOT-ANLY1: Operational KPIs\nDEPOT-ANLY-AD: Anomaly Detection", "KPI metrics + anomaly detection"],
        ["@Keerthi", "Dashboard polish + frontend integration testing", "Connect all Depot components to dashboard"],
        ["@Pranishree", "Test Depot vision + operations pipeline", "E2E: camera → detection → counting"],
    ],
    col_widths=[3, 4.5, 9]
)

# Day 8
doc.add_heading("Day 8 (Wednesday) — Stream + Depot Orchestrator", level=3)
make_table(doc,
    ["Developer", "Feature(s)", "Details"],
    [
        ["@Suraj", "STR-RR2: Distress Probability", "Financial distress scoring, Z-score modeling"],
        ["@Chetan", "DEPOT-ORCH1: Cross-Module Optimization", "Multi-objective optimization + recommendations"],
        ["@Keerthi", "STR-DASH: Stream Dashboard", "Credit rating + distress probability UI"],
        ["@Pranishree", "Integration testing — Depot operations flow", "Task → checklist → monitoring → escalation"],
    ],
    col_widths=[3, 4.5, 9]
)

# Day 9
doc.add_heading("Day 9 (Thursday) — Orchestrator + Stretch", level=3)
make_table(doc,
    ["Developer", "Feature(s)", "Details"],
    [
        ["@Suraj", "DEPOT-ORCH2: Scenario Simulation\nDEPOT-ORCH-RL: Revenue Leakage", "Simulation + leakage detection"],
        ["@Chetan", "WF-6.13: Workflow Automation [STRETCH]", "Build only if on track"],
        ["@Keerthi", "Polish all dashboards + responsive testing", "Executive, Depot, Stream dashboards"],
        ["@Pranishree", "End-to-end testing all Depot features", "Full workflow testing with mock data"],
    ],
    col_widths=[3, 4.5, 9]
)

# Day 10
doc.add_heading("Day 10 (Friday) — Integration, Testing & Polish", level=3)
make_table(doc,
    ["Developer", "Feature(s)", "Details"],
    [
        ["@Suraj", "Cross-product integration testing", "Test AI orchestration across all products"],
        ["@Chetan", "Analytics pipeline testing", "Predictive → simulation → reports flow"],
        ["@Keerthi", "UI polish, error states, loading states", "Final frontend pass"],
        ["@Pranishree", "Full regression testing + documentation", "End-to-end everything"],
    ],
    col_widths=[3, 4.5, 9]
)

doc.add_page_break()

# ══════════════════════════════════════════════════════════════════════
# 6. TECH STACK
# ══════════════════════════════════════════════════════════════════════

doc.add_heading("6. Technology Stack", level=1)

make_table(doc,
    ["Layer", "Technology", "Purpose"],
    [
        ["Backend", "Python 3.11+, FastAPI", "API framework"],
        ["Backend", "SQLAlchemy 2.0 + Alembic", "ORM & migrations"],
        ["Backend", "Celery + Redis", "Task queue & caching"],
        ["Frontend", "React 18+ with TypeScript", "UI framework"],
        ["Frontend", "Zustand", "State management"],
        ["Frontend", "Tailwind CSS + shadcn/ui", "Styling & components"],
        ["Frontend", "Axios + React Query", "API client"],
        ["AI / ML", "Custom LLM Engine", "Multi-model orchestration"],
        ["AI / ML", "Pinecone / Weaviate", "Vector database"],
        ["AI / ML", "YOLO v8 + OpenCV", "Computer vision (Depot)"],
        ["AI / ML", "spaCy, HuggingFace", "NLP processing"],
        ["Infra", "PostgreSQL 15+", "Primary database"],
        ["Infra", "Elasticsearch", "Search"],
        ["Infra", "S3 / MinIO", "File storage"],
        ["Infra", "Docker + Docker Compose", "Containerization"],
        ["Testing", "pytest, Vitest, Playwright", "Backend, frontend, E2E"],
    ],
    col_widths=[3, 5, 8.5]
)

# ══════════════════════════════════════════════════════════════════════
# 7. SPRINT TIMELINE SUMMARY
# ══════════════════════════════════════════════════════════════════════

doc.add_heading("7. Sprint Timeline Summary", level=1)

make_table(doc,
    ["Phase", "Days", "Focus", "Outcome"],
    [
        ["Foundation", "Day 1", "Auth, Data, UI Shell, Shared Utils", "All teams can build independently"],
        ["Core Services", "Day 2", "AI, Gateway, Real-Time, Observability", "Platform services available"],
        ["Analytics + Depot Start", "Day 3–4", "Analytics engines, Vision, Inventory", "Depot product underway"],
        ["Operations + Platform", "Day 5", "Depot Ops, Reports, Configuration", "Week 1 wrap-up"],
        ["Depot Command", "Day 6", "Live monitoring, Fleet, Escalation", "Command layer complete"],
        ["Analytics + Stream", "Day 7", "KPIs, Anomaly, Credit Rating", "Stream begins"],
        ["Stream + Orchestrator", "Day 8", "Distress, Cross-module optimization", "All features coded"],
        ["Stretch + Polish", "Day 9", "Orchestrator completion, Stretch goals", "Feature freeze"],
        ["Testing & Integration", "Day 10", "E2E testing, bug fixes, polish", "MVP ready"],
    ],
    col_widths=[3.5, 2, 5, 6]
)

# ══════════════════════════════════════════════════════════════════════
# 8. KEY PRINCIPLES
# ══════════════════════════════════════════════════════════════════════

doc.add_heading("8. Key Principles", level=1)

for title, desc in [
    ("One Feature = One Branch = One Person — ", "no overlap, no conflicts."),
    ("Build Top-Down — ", "Layers 7→6→5→4 first, then product features in parallel."),
    ("Dependencies Are Strict — ", "never start a feature until all its dependencies are complete."),
    ("Orange = Reduced Scope — ", "7 features have simplified MVP scope to keep the sprint on track."),
    ("Test As You Go — ", "unit tests with every feature; integration testing in Week 2."),
    ("Push Early, Push Often — ", "claim features immediately, update status after completion."),
]:
    add_bullet(doc, desc, title)

doc.add_paragraph("")
doc.add_paragraph("")

# Footer
footer = doc.add_paragraph()
footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = footer.add_run("— End of MVP Plan of Action —")
run.font.size = Pt(11)
run.font.color.rgb = RGBColor(0x99, 0x99, 0x99)
run.italic = True

# ── Save ────────────────────────────────────────────────────────────
output_path = "/Users/SRJ/Desktop/Fidelis/Intelli/Intelli_MVP_Plan_of_Action.docx"
doc.save(output_path)
print(f"Document saved to: {output_path}")
