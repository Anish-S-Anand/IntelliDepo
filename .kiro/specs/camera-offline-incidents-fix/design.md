# Design Document

## Overview

This spec fixes two independent frontend bugs:
1. Camera feeds showing OFFLINE due to a failed cross-origin direct URL attempt in `VideoFeed.tsx`
2. Incidents page showing 0 counts because it queries the wrong backend table

Both fixes are frontend-only. No backend changes are required.

---

## Fix 1: Camera Feed OFFLINE

### Root Cause

`VideoFeed.tsx` constructs two URLs for the video stream:
```
directUrl  = `http://${window.location.hostname}:8000/depot/vision/cameras/video-library/${encodeURIComponent(videoFile)}/stream`
proxyUrl   = `/backend/depot/vision/cameras/video-library/${encodeURIComponent(videoFile)}/stream`
```

It sets `video.src = directUrl` first. HTML5 `<video>` elements load cross-origin URLs in `no-cors` mode — the browser sends the request but the response is opaque. For video streaming, the browser needs to read the response body (to decode frames), which it cannot do with an opaque response. The `video.onerror` fires, `tryFallback()` sets `video.src = proxyUrl`, but by this point the draw loop has already been running on an empty video, and the canvas never gets valid frames.

Additionally, the `video.oncanplay` handler sets `status = "live"` only after the video is ready to play. If the direct URL attempt consumes time before the fallback is tried, the user sees OFFLINE for longer than necessary, and in some browser/OS combinations the fallback also fails due to timing.

### Solution

Remove the direct URL entirely. Use only the proxy URL from the start:

```typescript
const videoUrl = `/backend/depot/vision/cameras/video-library/${encodeURIComponent(videoFile)}/stream`;
video.src = videoUrl;
```

The Next.js proxy (`/backend/:path*` → `http://127.0.0.1:8000/:path*`) is already configured in `next.config.mjs` and handles the rewrite server-side, so there is no CORS issue. The proxy also correctly passes `Range` headers through to the backend, which already supports partial content (206) responses.

### Files Changed

- `frontend/src/components/depot/cameras/VideoFeed.tsx` — remove `directUrl`, `triedFallback`, `tryFallback()` logic; use single proxy URL

---

## Fix 2: Incidents Showing 0 Counts

### Root Cause

The data flow mismatch:

```
Seed → ops_incidents table
                ↑
         /ops/incidents  (OpsIncident model, priority=P1/P2/P3/P4)

IncidentsPage → getIncidents() → /depot/vision/perimeter/incidents
                                          ↑
                                 depot_perimeter_incidents table (empty — only populated from breach escalation)
```

### Solution

**Step 1: Add ops incidents service functions**

Add to `frontend/src/services/depotOps.ts` (new file):
- `OpsIncidentResponse` interface matching the backend schema
- `getOpsIncidents(params?)` → `GET /ops/incidents`
- `acknowledgeOpsIncident(id, reason)` → `PATCH /ops/incidents/{id}/acknowledge`
- `resolveOpsIncident(id, notes, steps?)` → `PATCH /ops/incidents/{id}/resolve`

**Step 2: Update IncidentsPage mapping**

The `OpsIncident` shape differs from `PerimeterIncident`:

| Field | PerimeterIncident | OpsIncident |
|-------|-------------------|-------------|
| Severity | `severity` (critical/high/medium/low) | `priority` (P1/P2/P3/P4) |
| Location | `zone_id` (UUID) | `zone` (human-readable string) |
| Assignee | `acknowledged_by` or `escalated_to` | `assigned_to` |
| Breach link | `breach_id` | N/A |
| Video ref | `video_archive_ref` | N/A |

New `mapOpsIncident` function:
```typescript
function mapOpsIncident(inc: OpsIncidentResponse): Incident {
  const sevMap: Record<string, Incident["sev"]> = {
    P1: "CRITICAL",
    P2: "HIGH",
    P3: "MEDIUM",
    P4: "LOW",
  };
  const statusMap: Record<string, Incident["status"]> = {
    open: "open",
    acknowledged: "acknowledged",
    escalated: "acknowledged",
    in_progress: "acknowledged",
    resolved: "resolved",
    closed: "resolved",
  };
  return {
    id: String(inc.id),
    type: inc.title,
    sev: sevMap[inc.priority] ?? "MEDIUM",
    loc: inc.zone ?? "—",
    t: new Date(inc.created_at).toLocaleString([], { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" }),
    status: statusMap[inc.status] ?? "open",
    cam: "—",
    desc: inc.description ?? inc.title,
    assignee: inc.assigned_to ?? "—",
  };
}
```

**Step 3: Wire acknowledge/resolve to ops endpoints**

The `acknowledge()` and `handleResolve()` functions in `IncidentsPage` currently call `acknowledgeIncident` and `resolveIncident` from `depotPerimeter.ts` (which hit the perimeter endpoints). These need to call `acknowledgeOpsIncident` and `resolveOpsIncident` instead.

The `acknowledgeBreach()` function (for perimeter breach cards) still calls `createIncidentFromBreach` and `acknowledgeIncident` from `depotPerimeter.ts` — this remains unchanged.

### Files Changed

- `frontend/src/services/depotOps.ts` — new file with `OpsIncidentResponse`, `getOpsIncidents`, `acknowledgeOpsIncident`, `resolveOpsIncident`
- `frontend/src/components/depot/operations/IncidentsPage.tsx` — update imports, replace `getIncidents`/`acknowledgeIncident`/`resolveIncident` calls with ops equivalents, update `mapBackendIncident` → `mapOpsIncident`

---

## No Backend Changes Required

The backend already has:
- `/ops/incidents` GET endpoint returning `OpsIncident` records
- `/ops/incidents/{id}/acknowledge` PATCH endpoint
- `/ops/incidents/{id}/resolve` PATCH endpoint
- Video stream endpoint with full Range support and moov-atom reordering
- Next.js proxy correctly configured

---

## Regression Safety

- The perimeter breach section (`getActiveBreaches`, `createIncidentFromBreach`, `acknowledgeIncident` from `depotPerimeter.ts`) is untouched
- The `incidentByBreachId` map used to link breach cards to perimeter incidents is removed (no longer needed since we're showing ops incidents, not perimeter incidents)
- The video analysis modal for breach cards remains unchanged
- The resolve modal UX remains unchanged
