# AI Warehouse / Command & Control Gap Plan

This document consolidates the current implementation status against the manager feedback list, identifies what must change, and explains how the next build phases should be executed.

## 1. Current Status Summary

The platform already has a strong technical foundation for depot operations, camera monitoring, gate access, incidents, command actions, and notifications. The main gap is productization: the current flow is still closer to a technical operations demo than a business-ready Command & Control platform.

The next phase should focus on:

- Unified business incident workflow
- Real notification delivery and tracking
- Persona-specific command center views
- Clear Visibility / Control / Analysis dashboard structure
- Warehouse hierarchy standardization
- CCTV evidence linkage
- Broadcast and escalation workflows

## 1.1 Implementation Progress

Recently completed:

- Added unified incident APIs for list, detail, notification status, and business actions.
- Added frontend incident business detail drawer with evidence, notification delivery, timeline, and action controls.
- Added WhatsApp notification provider abstraction/stub.
- Expanded Broadcast to include use case, recipients, channels, and priority.
- Reframed Command Center around Visibility, Control, and Analysis.
- Added persona-specific Command Center routes:
  - `/depot/command/warehouse`
  - `/depot/command/regional`
  - `/depot/command/central`
  - `/depot/command/admin`
- Updated login flow so demo role accounts land on their persona-specific Command Center.
- Added Central Manager demo account.
- Updated sidebar Command Center link to respect the logged-in persona.
- Added role rules:
  - Warehouse Manager: local warehouse operations
  - Regional Manager: regional warehouse visibility
  - Central Manager: all-region broadcast and escalation
  - Administrator: full access
- Added demo hierarchy endpoint for:
  `Fidelis -> South Region -> Bengaluru/Hyderabad Warehouse` and
  `Fidelis -> West Region -> Mumbai Warehouse`.
- Standardized operational grouping to Zone 1, Zone 2, Zone 3 with Gates 1-3 and camera-to-zone/gate mapping.
- Added hierarchy panel to the Command Center.
- Added LPR denied-access events into the unified incident feed as unauthorized-entry incidents with an explicit reason.
- Kept KPI dashboard limited to real backend sources currently available.
- Removed WhatsApp from the new frontend delivery-channel options per current scope.

Still pending:

- Persistent warehouse hierarchy model and migrations.
- Consolidated scoped KPI API for additional real sources when loaded/unloaded bags, worker count, and unloading time are available.
- CCTV hierarchy grouping and multi-camera evidence view.
- Stronger database-level RBAC and warehouse/region scoping once tenant/location assignments are persisted.

## 2. Completed Features

### Incident Management

Implemented:

- Perimeter incident backend exists in `backend/app/depot/vision/perimeter.py`.
- Ops incident backend exists in `backend/app/depot/ops/incidents.py`.
- Incident create, list, active list, acknowledge, resolve, and escalation APIs exist.
- Incident audit timeline exists through `ops_incident_audit`.
- Incident notification records exist through `ops_incident_notifications`.
- Perimeter incidents support `video_archive_ref` for CCTV evidence linkage.
- Perimeter breaches can be converted into incidents.
- Auto-escalation endpoints exist for unresolved incidents.
- Tests exist for incident acknowledgement.

Current limitation:

- Incident handling is still generic: acknowledge and resolve actions do not fully reflect warehouse business response steps.
- Incident data is split between perimeter incidents and ops incidents.
- Incident severity is inconsistent across modules: some use `low/medium/high/critical`, while others use `P1/P2/P3/P4`.

### Notifications

Implemented:

- Core notification engine exists in `backend/app/core/notifications`.
- Notification channels include email, SMS, WhatsApp, Slack, Teams, in-app, and webhook in the model.
- Email channel implementation exists.
- Notification history and delivery status APIs exist in the generic notification engine.
- Incident-specific notification records exist.
- Real-time app broadcast through WebSocket exists for command events.

Current limitation:

- WhatsApp is modeled but not fully implemented with a provider adapter.
- Incident notification status is mostly recorded as `sent`; it does not yet track full provider lifecycle such as queued, delivered, failed, retrying, or read.
- Incident notifications are not yet shown as a clear delivery-status panel in the UI.

### Security and Unauthorized Entry

Implemented:

- Perimeter breaches support unauthorized entry, loitering, forced entry, after-hours entry, and unknown events.
- Gate/LPR module handles vehicle access decisions.
- Access logs include plate number, gate, decision, direction, and denied reason.
- Gate console includes vehicle registry, blacklist flow, visitor management, and footage modal.
- CCTV snapshot and video helper APIs exist.

Current limitation:

- Unauthorized entry is not yet a unified workflow across LPR, perimeter, CCTV evidence, notification, escalation, and incident resolution.
- Gate number, detected entity, alert recipient, and evidence are not always shown together in one incident view.

### Command Center

Implemented:

- Command Center frontend exists in `frontend/src/components/depot/operations/CommandPage.tsx`.
- Command Center backend exists in `backend/app/depot/ops/command.py`.
- Command snapshot API exists.
- Quick actions exist for:
  - Open gate
  - Close gate
  - Lock zone
  - Broadcast / trigger alert
  - Contact operator
- Command action logs exist.
- Command timeline exists.
- Command dashboard shows health score, KPIs, recent activity, gates, and cameras.

Current limitation:

- The dashboard is not yet explicitly structured around Visibility, Control, and Analysis.
- It is primarily a Warehouse Manager view.
- Regional Manager, Central Manager, and Administrator views are not yet implemented.

### Broadcast

Implemented:

- UI already uses the name `Broadcast`.
- Broadcast modal exists in the Command Center.
- Broadcast banner exists globally in `frontend/src/components/depot/layout/BroadcastBanner.tsx`.
- Broadcast creates a command alert incident and publishes a real-time event.

Current limitation:

- Broadcast does not yet support explicit use cases like fire alert, smoke detection, intruder alert, weather warning, or operational announcement.
- Broadcast recipients are not configurable.
- Delivery channels are not selectable in the current workflow.
- Delivery status is not displayed.

### CCTV and Camera Management

Implemented:

- Camera registration, listing, connection, reconnection, snapshot, MJPEG stream, and RTSP proxy helper functions exist.
- Camera health/status is available through camera status and last seen fields.
- Command Center and Dashboard show camera summaries.
- Evidence video mapping exists for some seeded incident cases.

Current limitation:

- Cameras are not formally organized by Organization, Region, Warehouse, Cluster, Zone, Gate.
- Multi-camera command view is not fully mature.
- Incident-linked footage is partial and should be standardized.

### Warehouse Hierarchy

Implemented:

- Gates, cameras, zones, clusters, and depot zones exist in separate modules.
- Cluster and zone capacity features exist.

Current limitation:

- There is no single formal hierarchy model:
  `Organization -> Region -> Warehouse -> Cluster -> Gates -> Cameras`
- Some labels are still free-text or generated, such as brand-like zone labels.
- Cluster naming should be standardized to `Cluster 1`, `Cluster 2`, `Cluster 3`.

### KPIs and Analytics

Implemented:

- Several KPI sources already exist:
  - Cameras
  - Gates
  - Incidents
  - Inventory exceptions
  - Capacity risk
  - Access denials
  - Low stock
  - Backend observability

Current limitation:

- Required warehouse KPIs are not consolidated into one business dashboard:
  - Bags loaded today
  - Bags unloaded today
  - Vehicle count
  - Average unloading time
  - Incidents today
  - Cluster occupancy
  - Capacity remaining
  - Worker count
  - Entry/exit count

### Boom Barrier

Implemented:

- Gate open and close actions exist.
- Gate action logs exist.
- Command Center can remotely open/close gates through the backend.

Current limitation:

- There is no dedicated boom barrier hardware abstraction.
- Vendor/device API integration is not defined.
- Persona-based restrictions need to be enforced clearly.
- Barrier logs should be separated from generic command logs.

### Branding

Implemented:

- Logo and theme assets exist.

Current limitation:

- Some temporary naming, placeholder labels, and inconsistent product names remain.
- Branding cleanup is lower priority but still needed before demo or client presentation.

## 3. Required Changes

### A. Create a Unified Incident Model

Problem:

Incident data is spread across perimeter incidents, ops incidents, breaches, gate access logs, and manual command alerts.

Required change:

Create one frontend-facing incident contract that all incident sources map into.

Suggested fields:

```ts
interface UnifiedIncident {
  id: string;
  incident_type: string;
  severity: "critical" | "warning" | "info";
  priority: "P1" | "P2" | "P3" | "P4";
  status: "new" | "assigned" | "response_started" | "escalated" | "resolved" | "closed";
  timestamp: string;
  organization_id?: string;
  region_id?: string;
  warehouse_id?: string;
  cluster_id?: string;
  gate_id?: string;
  camera_id?: string;
  location_label: string;
  assigned_to?: string;
  detected_entity?: "person" | "vehicle" | "unknown";
  vehicle_plate?: string;
  evidence_snapshot_url?: string;
  evidence_video_url?: string;
  notification_summary: NotificationSummary[];
  timeline: IncidentTimelineItem[];
}
```

How to do it:

1. Add a backend mapper service that normalizes perimeter, ops, gate, and command-alert incidents.
2. Add endpoint `GET /depot/incidents/unified`.
3. Add endpoint `GET /depot/incidents/{id}/detail`.
4. Update incident frontend pages to read the unified contract.
5. Keep old APIs working while the UI migrates.

### B. Replace Generic Incident Actions with Business Actions

Problem:

Actions such as acknowledge and resolve are too generic for warehouse users.

Required change:

Use business-context actions:

- Assign responder
- Dispatch security
- Notify supervisor
- Mark false alarm
- Escalate to regional manager
- Start response
- Resolve with outcome
- Attach evidence

How to do it:

1. Keep backend acknowledge/resolve for compatibility.
2. Add new action endpoint:
   `POST /depot/incidents/{id}/actions`
3. Store each action in the incident timeline.
4. Show action buttons based on incident type and status.

### C. Implement Real Notification Delivery Tracking

Problem:

Notification status is not complete enough for business users.

Required change:

Track delivery by channel and recipient:

- pending
- queued
- sending
- sent
- delivered
- failed
- retrying
- read

How to do it:

1. Extend `ops_incident_notifications`.
2. Store provider message ID and error message.
3. Add channel adapters for WhatsApp and app notifications.
4. Reuse existing email channel.
5. Add endpoint `GET /depot/incidents/{id}/notifications`.
6. Add UI delivery status panel inside incident detail.

### D. Add WhatsApp Integration

Problem:

WhatsApp exists in the model but not as a real provider.

Required change:

Add provider abstraction so the implementation can support Twilio, Meta Cloud API, or another vendor.

How to do it:

1. Create `backend/app/core/notifications/channels/whatsapp.py`.
2. Add configuration values for provider credentials.
3. Implement send function with provider response handling.
4. Record provider message ID in notification metadata.
5. Add tests with mocked provider responses.

### E. Build Unauthorized Entry Workflow

Problem:

Unauthorized entry is detected, but not presented as an immediate business workflow.

Required change:

Create a single unauthorized-entry incident flow.

Workflow:

1. LPR denial or perimeter breach occurs.
2. Backend creates unified incident.
3. Backend attaches gate, time, detected entity, camera, snapshot/video evidence.
4. Backend sends notifications to configured recipients.
5. UI shows immediate alert.
6. If unresolved, escalation job escalates it.
7. Timeline records all state changes.

Required UI fields:

- Gate number
- Entry time
- Person or vehicle detected
- Vehicle plate if available
- Alert recipient
- Evidence link
- Assigned person
- Escalation state

### F. Redesign Command Center Around Three Pillars

Problem:

The current command page has useful widgets, but the business purpose is not explicit.

Required change:

Redesign command center into:

- Visibility
- Control
- Analysis

Visibility should include:

- Cameras
- Vehicles
- Entry/exit
- Bags loaded/unloaded
- Cluster occupancy
- Workers inside warehouse

Control should include:

- Open/close boom barriers
- Broadcast
- Trigger notifications
- Manage access permissions

Analysis should include:

- Vehicle count
- Loading/unloading stats
- Incident count
- Cluster utilization
- Capacity usage

How to do it:

1. Keep existing Command Center route.
2. Refactor current page into three sections or tabs.
3. Reuse existing gate, camera, incident, and command APIs.
4. Add missing KPI APIs before wiring final analytics.

### G. Add Persona-Based Views

Problem:

The system does not yet adapt to the user role.

Required change:

Create views for:

- Warehouse Manager
- Regional Manager
- Central Manager
- Administrator

How to do it:

1. Define role capabilities in a persona-feature matrix.
2. Add route-level UI variants:
   - `/depot/command/warehouse`
   - `/depot/command/regional`
   - `/depot/command/central`
   - `/depot/command/admin`
3. Use RBAC to control actions.
4. Show only relevant controls per persona.

Persona mapping:

| Persona | Visibility | Control | Analysis |
| --- | --- | --- | --- |
| Warehouse Manager | Cameras, vehicles, entry/exit, bags, clusters, workers | Boom barriers, broadcasts, access permissions, notifications | Vehicle count, loading stats, incidents, utilization, capacity |
| Regional Manager | Multi-warehouse visibility, regional incidents | Regional broadcasts and escalations | Regional analytics, cross-warehouse comparison |
| Central Manager | National/global warehouse visibility | Central command governance | KPI dashboards, national trends, major incident analytics |
| Administrator | Platform configuration, users, hierarchy, integrations | Permissions, templates, integrations | Audit, adoption, integration health |

### H. Expand Broadcast

Problem:

Broadcast is currently a message alert, not a full alerting system.

Required change:

Broadcast should support:

- Fire alert
- Smoke detection
- Intruder alert
- Weather warning
- Operational announcement

Recipients:

- Workers
- Warehouse staff
- Managers
- Custom group

Channels:

- WhatsApp
- Email
- Speaker announcement
- App notification

How to do it:

1. Add broadcast type, audience, scope, and channels to the request.
2. Create broadcast records in backend.
3. Dispatch notifications through selected channels.
4. Continue publishing in-app real-time banner.
5. Show delivery status after send.

### I. Standardize CCTV and Camera Management

Problem:

Cameras are technically available, but not organized in the operational hierarchy.

Required change:

Organize cameras by:

- Warehouse
- Cluster
- Zone
- Gate

How to do it:

1. Extend camera model with hierarchy references.
2. Add camera health endpoint:
   `GET /depot/cameras/health`
3. Add incident evidence endpoint:
   `GET /depot/incidents/{id}/evidence`
4. Build multi-camera grid view.
5. Add camera-to-incident linking in the unified incident model.

### J. Add Warehouse Hierarchy

Problem:

Warehouse structure is not standardized.

Required change:

Implement:

```text
Organization
  -> Region
    -> Warehouse
      -> Cluster
        -> Gate
          -> Camera
```

How to do it:

1. Add backend models and migrations.
2. Seed default hierarchy for demo.
3. Replace AI-generated or brand-like labels with `Cluster 1`, `Cluster 2`, `Cluster 3`.
4. Add hierarchy selector in Command Center.
5. Use hierarchy filters across incidents, cameras, gates, and KPIs.

### K. Add Dashboard KPI API

Problem:

KPIs exist in fragments.

Required change:

Create one scoped KPI endpoint:

```text
GET /depot/command/kpis?scope=warehouse|region|central
```

Required KPIs:

- Bags loaded today
- Bags unloaded today
- Vehicle count
- Average unloading time
- Incidents today
- Cluster occupancy
- Capacity remaining
- Worker count
- Entry/exit count

How to do it:

1. Reuse counting, gate, cluster, incident, and worker/labor data sources.
2. Add fallback/demo values only where source is not ready.
3. Return consistent KPI metadata: label, value, trend, severity, source.
4. Update Command Center Analysis section.

### L. Define Boom Barrier Integration

Problem:

Gate open/close exists, but hardware integration is not formalized.

Required change:

Add boom barrier integration layer.

Suggested endpoints:

```text
POST /depot/gates/{gate_id}/barrier/open
POST /depot/gates/{gate_id}/barrier/close
GET /depot/gates/{gate_id}/barrier/status
GET /depot/gates/{gate_id}/barrier/logs
```

How to do it:

1. Create a hardware adapter interface.
2. Add vendor-specific implementation later.
3. Add timeout and failure handling.
4. Restrict access by persona.
5. Store command logs separately from generic actions.

## 4. Recommended Build Phases

### Phase 1: High Priority Incident and Notification Upgrade

Deliverables:

- Unified incident detail contract
- Business incident actions
- Incident timeline UI
- Evidence link panel
- Notification delivery status panel
- WhatsApp adapter stub/provider abstraction
- Email and app notification wiring

Files likely involved:

- `backend/app/depot/ops/incidents.py`
- `backend/app/depot/vision/perimeter.py`
- `backend/app/core/notifications`
- `frontend/src/services/depotOps.ts`
- `frontend/src/services/depotPerimeter.ts`
- `frontend/src/components/depot/operations/IncidentsPage.tsx`
- `frontend/src/components/depot/operations/PerimeterSecurityPage.tsx`

### Phase 2: Command Center Redesign

Deliverables:

- Visibility / Control / Analysis structure
- Broadcast enhancement
- Business KPI panel
- Camera/gate/incident/evidence consolidation
- Cleaner operational UI

Files likely involved:

- `frontend/src/components/depot/operations/CommandPage.tsx`
- `frontend/src/services/depotCommand.ts`
- `backend/app/depot/ops/command.py`
- `frontend/src/components/depot/layout/BroadcastBanner.tsx`

### Phase 3: Persona Views

Deliverables:

- Persona-feature matrix
- Warehouse Manager command view
- Regional Manager command view
- Central Manager/Admin command view
- RBAC-based control visibility

Files likely involved:

- `frontend/src/app/depot/command`
- `frontend/src/components/depot/operations`
- `backend/app/core/auth`
- `backend/app/depot/ops/command.py`

### Phase 4: Warehouse Hierarchy and Camera Organization

Deliverables:

- Organization/Region/Warehouse/Cluster/Gate/Camera model
- Standard cluster naming
- Camera grouping
- Hierarchy filters
- Incident and KPI scoping

Files likely involved:

- New backend hierarchy module
- Existing camera, gate, cluster, command modules
- Frontend hierarchy selector/components

### Phase 5: Analytics and Boom Barrier Integration

Deliverables:

- Consolidated KPI endpoint
- Analysis dashboard widgets
- Boom barrier hardware adapter
- Barrier status and logs
- Persona-based remote-control permissions

Files likely involved:

- `backend/app/depot/ops/command.py`
- `backend/app/depot/gate`
- `frontend/src/services/depotCommand.ts`
- `frontend/src/components/depot/operations/CommandPage.tsx`

### Phase 6: Branding and Demo Polish

Deliverables:

- Remove placeholder text
- Standardize product naming
- Replace temporary labels
- Clean logo usage
- Demo-ready incident and broadcast workflows

## 5. Priority Order

1. Incident Notifications - High
2. Persona Mapping - High
3. Command Center Redesign - High
4. Unauthorized Entry Workflow - High
5. Broadcast Delivery and Recipient Flow - High
6. Warehouse Hierarchy - Medium
7. Analytics KPIs - Medium
8. CCTV Organization and Evidence Standardization - Medium
9. Boom Barrier Vendor Integration - Medium
10. Branding Cleanup - Low

## 6. Immediate Next Sprint Plan

Recommended first sprint scope:

1. Create unified incident detail API.
2. Add incident detail drawer in the frontend.
3. Show incident type, timestamp, gate/location, warehouse/cluster, assigned person, severity, evidence link, timeline, and notifications.
4. Add business actions: dispatch security, notify supervisor, escalate, mark false alarm, resolve.
5. Add notification status panel with app/email/WhatsApp rows.
6. Enhance Broadcast modal with type, recipients, and channels.
7. Update Command Center layout into Visibility, Control, and Analysis.

This creates the highest demo value because it directly addresses the manager's top priorities while reusing existing backend foundations.
