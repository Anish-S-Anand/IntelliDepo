# Requirements Document

## Introduction

Two features in the IntelliDepo dashboard are broken:

1. **IntelliVision camera feeds show OFFLINE** — All 6 camera feeds display "OFFLINE" despite the backend successfully connecting to local video files. The `VideoFeed` component first attempts a direct cross-origin request to `http://localhost:8000/...`, which fails silently in the browser (video elements use `no-cors` mode and cannot read cross-origin responses), then falls back to the proxy URL. The fallback also fails because the error handler fires before the proxy URL is tried correctly. The fix is to use only the Next.js proxy URL (`/backend/...`) from the start, eliminating the cross-origin attempt entirely.

2. **Incidents & Alerts page shows 0 counts** — The `IncidentsPage` component fetches from `/depot/vision/perimeter/incidents` (the `depot_perimeter_incidents` table, populated only when a perimeter breach is manually escalated). The seed data populates `ops_incidents` (a separate operational incidents table via `/ops/incidents`). The fix is to wire the Incidents page to call `/ops/incidents` instead, and update the data mapping to match the `OpsIncident` response shape (which uses `priority` P1/P2/P3/P4 instead of `severity`, and `zone` instead of `zone_id`).

## Requirements

### Requirement 1: Camera feeds load and play video

**User Story:** As a depot operator, I want to see live camera feeds in IntelliVision so that I can monitor the depot in real time.

#### Acceptance Criteria

1.1 WHEN the IntelliVision page loads THEN all 6 camera feeds SHALL attempt to stream video using only the Next.js proxy URL (`/backend/depot/vision/cameras/video-library/{filename}/stream`) without first attempting a direct cross-origin request to port 8000.

1.2 WHEN the video stream loads successfully THEN the feed SHALL display "LIVE" status (green indicator) and render video frames on the canvas.

1.3 WHEN the video stream fails to load (file not found, network error) THEN the feed SHALL display "OFFLINE" status (red indicator) with a dark placeholder background.

1.4 WHEN the video is loading THEN the feed SHALL display "CONNECTING" status (grey indicator) until the stream is ready.

1.5 WHEN the video loads successfully THEN the canvas SHALL continuously render frames from the video in a draw loop.

### Requirement 2: Incidents page shows seeded operational incidents

**User Story:** As a depot operator, I want to see all active incidents on the Incidents & Alerts page so that I can track and respond to operational issues.

#### Acceptance Criteria

2.1 WHEN the Incidents page loads THEN it SHALL fetch incidents from `/ops/incidents` (the `ops_incidents` table) instead of `/depot/vision/perimeter/incidents`.

2.2 WHEN the backend returns incidents THEN the Open, Acknowledged, Resolved, and Critical counts SHALL reflect the actual data (e.g., with 6 seeded incidents: Open=4, Acknowledged=1, Resolved=0, Critical=0 based on seed data priorities).

2.3 WHEN mapping backend `OpsIncident` responses to the UI `Incident` shape THEN the mapping SHALL correctly translate:
- `priority` (P1/P2/P3/P4) → `sev` (CRITICAL/HIGH/MEDIUM/LOW)
- `status` (open/acknowledged/escalated/in_progress/resolved/closed) → UI status
- `zone` → `loc` (location display)
- `assigned_to` → `assignee`
- `incident_type` → displayed as category context

2.4 WHEN a user clicks "Acknowledge" on an incident THEN the page SHALL call `PATCH /ops/incidents/{id}/acknowledge` and refresh the list.

2.5 WHEN a user clicks "Resolve" on an incident THEN the page SHALL call `PATCH /ops/incidents/{id}/resolve` with resolution notes and refresh the list.

2.6 WHEN the Incidents page polls every 20 seconds THEN it SHALL continue to call `/ops/incidents` for fresh data.

2.7 WHEN the "Active Perimeter Breaches" section is displayed THEN it SHALL continue to fetch from `/depot/vision/perimeter/breaches/active` unchanged — only the incidents list source changes.

### Requirement 3: Frontend service layer updated

**User Story:** As a developer, I want the service layer to expose a clean `getOpsIncidents` function so that the Incidents page can fetch operational incidents without coupling to the perimeter module.

#### Acceptance Criteria

3.1 A new `getOpsIncidents` function SHALL be added to the frontend service layer (either in `depotPerimeter.ts` or a new `depotOps.ts` service file) that calls `GET /ops/incidents`.

3.2 The `OpsIncidentResponse` TypeScript interface SHALL match the backend `IncidentResponse` schema from `/ops/incidents`, including fields: `id`, `title`, `description`, `incident_type`, `source`, `priority`, `severity_score`, `status`, `zone`, `assigned_to`, `escalation_level`, `escalation_deadline`, `acknowledged_at`, `acknowledged_by`, `resolved_at`, `resolved_by`, `resolution_notes`, `created_at`.

3.3 `acknowledgeOpsIncident` and `resolveOpsIncident` functions SHALL be added that call `PATCH /ops/incidents/{id}/acknowledge` and `PATCH /ops/incidents/{id}/resolve` respectively.

3.4 The existing perimeter incident functions (`getIncidents`, `acknowledgeIncident`, `resolveIncident`) SHALL remain unchanged to avoid breaking the perimeter breach workflow.
