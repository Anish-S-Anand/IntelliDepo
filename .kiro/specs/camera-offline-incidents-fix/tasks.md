# Implementation Plan:

## Overview

Fix two frontend bugs: camera feeds showing OFFLINE due to cross-origin video URL failure, and Incidents page showing 0 counts due to querying the wrong backend table.

## Tasks

- [ ] 1. Fix VideoFeed to use proxy URL only
  - [ ] 1.1 In `frontend/src/components/depot/cameras/VideoFeed.tsx`, remove the `directUrl` variable and the `triedFallback` / `tryFallback` fallback logic
  - [ ] 1.2 Replace `video.src = directUrl` with `video.src = \`/backend/depot/vision/cameras/video-library/${encodeURIComponent(videoFile)}/stream\``
  - [ ] 1.3 Remove the `video.onerror` handler that called `tryFallback` and replace with a simple handler that sets `status("error")` directly
  - [ ] 1.4 Verify the canvas draw loop still starts immediately after `video.load()` and renders frames once `video.readyState >= 2`

- [ ] 2. Create ops incidents service
  - [ ] 2.1 Create `frontend/src/services/depotOps.ts` with an `OpsIncidentResponse` TypeScript interface matching the backend `/ops/incidents` response shape (fields: `id`, `title`, `description`, `incident_type`, `source`, `priority`, `severity_score`, `status`, `zone`, `assigned_to`, `escalation_level`, `escalation_deadline`, `acknowledged_at`, `acknowledged_by`, `resolved_at`, `resolved_by`, `resolution_notes`, `created_at`)
  - [ ] 2.2 Add `getOpsIncidents(params?: { status?: string; priority?: string })` function that calls `GET /ops/incidents` via the existing `api` axios instance
  - [ ] 2.3 Add `acknowledgeOpsIncident(incidentId: string, reason: string)` function that calls `PATCH /ops/incidents/{incidentId}/acknowledge`
  - [ ] 2.4 Add `resolveOpsIncident(incidentId: string, resolutionNotes: string, resolutionSteps?: string[])` function that calls `PATCH /ops/incidents/{incidentId}/resolve`

- [ ] 3. Wire IncidentsPage to ops incidents
  - [ ] 3.1 In `frontend/src/components/depot/operations/IncidentsPage.tsx`, add imports for `getOpsIncidents`, `acknowledgeOpsIncident`, `resolveOpsIncident`, and `OpsIncidentResponse` from `@/services/depotOps`
  - [ ] 3.2 Replace the `mapBackendIncident` function with a new `mapOpsIncident(inc: OpsIncidentResponse): Incident` function that maps `priority` (P1→CRITICAL, P2→HIGH, P3→MEDIUM, P4→LOW) to `sev`, maps `status` (escalated/in_progress → "acknowledged", closed → "resolved"), uses `zone` for `loc`, and uses `assigned_to` for `assignee`
  - [ ] 3.3 Replace the `fetchIncidents` callback to call `getOpsIncidents()` instead of `getIncidents()`, and update state types from `IncidentResponse[]` to `OpsIncidentResponse[]`
  - [ ] 3.4 Update the `acknowledge` function to call `acknowledgeOpsIncident(id, "Acknowledged from incident console")` instead of `acknowledgeIncident`
  - [ ] 3.5 Update the `handleResolve` function to call `resolveOpsIncident(resolveModalId, resolveNotes)` instead of `resolveIncident`
  - [ ] 3.6 Remove the `incidentByBreachId` map and `rawIncidents` state (no longer needed); keep `breaches` state and `fetchBreaches` unchanged
  - [ ] 3.7 Remove unused imports (`getIncidents`, `acknowledgeIncident`, `resolveIncident`, `IncidentResponse` from `depotPerimeter`) — keep `getActiveBreaches`, `createIncidentFromBreach`, `BreachResponse` since the breach section is unchanged

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1", "2"] },
    { "wave": 2, "tasks": ["3"] }
  ]
}
```

## Notes

- No backend changes required — all fixes are frontend-only
- The perimeter breach section in IncidentsPage is untouched
- The video analysis modal for breach cards is untouched
- Tasks 1 and 2 can be executed in parallel
