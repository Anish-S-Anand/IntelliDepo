# Implementation Plan: Incidents Data Restoration

## Overview

This implementation plan restores full functionality to the `/depot/incidents` page by integrating the existing UI framework with backend APIs and real incident data. The implementation follows a layered approach: first enhancing backend seed data and verifying API endpoints, then integrating data into the frontend, adding video analysis capabilities, implementing incident workflows, and finally adding filtering and statistics.

## Tasks

- [ ] 1. Enhance backend seed data for perimeter incidents
  - [x] 1.1 Update seed script to create perimeter zones
    - Modify `backend/alembic/versions/seed_intelliops.py` to create 4 perimeter zones: Cold Storage, Inbound Gate, Staging Area, Dispatch Bay
    - Each zone should have `zone_type="controlled"`, `alert_on_entry=True`, `alert_severity="high"`
    - Store zone references in a dictionary for later use
    - _Requirements: 12.1, 12.5_
  
  - [x] 1.2 Update seed script to create perimeter breaches
    - Create 5 perimeter breaches corresponding to the 5 sample incidents
    - Map incident source to breach_type: perimeter→unauthorized_entry, alert→loitering, sensor→unknown, sla_breach→after_hours
    - Set appropriate severity levels: P1→critical, P2→high, P3→medium, default→low
    - Set `detected_at` to current timestamp, `alert_sent=True`
    - _Requirements: 12.2, 12.3, 12.4_
  
  - [ ] 1.3 Update seed script to create incidents from breaches
    - For each breach, create a corresponding incident using the breach data
    - Set `title`, `description`, `severity`, `zone_id`, `breach_id`, `status="open"`
    - Assign `video_archive_ref` based on breach_type using the mapping: unauthorized_entry→Perimeter_Detection.mp4, loitering→Theft Camera .mp4, forced_entry→Perimeter_Detection.mp4, after_hours→Perimeter_Detection.mp4, object_left→Theft Camera .mp4, unknown→LPR_RECOGNITION.mp4
    - Set `escalation_deadline` to 5 minutes from creation for critical incidents
    - _Requirements: 12.1, 12.2, 2.1, 2.4_

- [ ] 2. Verify and fix backend API endpoints
  - [ ] 2.1 Verify GET /depot/vision/perimeter/incidents endpoint
    - Test the endpoint returns incidents with all required fields: id, breach_id, zone_id, severity, title, description, status, video_archive_ref, created_at, acknowledged_at, acknowledged_by, resolved_at, resolved_by, resolution_notes
    - Verify filtering by status and severity query parameters works correctly
    - If endpoint is missing or incomplete, implement it in `backend/app/intellivision/perimeter/routes.py`
    - _Requirements: 1.1, 1.2_
  
  - [ ] 2.2 Verify GET /depot/vision/perimeter/breaches/active endpoint
    - Test the endpoint returns active breaches (where resolved_at is null)
    - Verify response includes: id, zone_id, camera_id, breach_type, severity, confidence, snapshot_ref, alert_sent, notes, detected_at, created_at
    - If endpoint is missing or incomplete, implement it in `backend/app/intellivision/perimeter/routes.py`
    - _Requirements: 10.2, 10.3_
  
  - [ ] 2.3 Verify PATCH /depot/vision/perimeter/incidents/{incident_id}/acknowledge endpoint
    - Test the endpoint accepts `reason` in request body
    - Verify it updates status to "acknowledged", sets acknowledged_at to current timestamp, and sets acknowledged_by to current user
    - Verify it returns the updated incident
    - If endpoint is missing or incomplete, implement it in `backend/app/intellivision/perimeter/routes.py`
    - _Requirements: 6.2, 6.3_
  
  - [ ] 2.4 Verify PATCH /depot/vision/perimeter/incidents/{incident_id}/resolve endpoint
    - Test the endpoint accepts `resolution_notes` in request body
    - Verify it updates status to "resolved", sets resolved_at to current timestamp, sets resolved_by to current user, and stores resolution_notes
    - Verify it returns the updated incident
    - If endpoint is missing or incomplete, implement it in `backend/app/intellivision/perimeter/routes.py`
    - _Requirements: 7.4, 7.5_
  
  - [ ] 2.5 Verify POST /depot/vision/perimeter/incidents/from-breach/{breach_id} endpoint
    - Test the endpoint creates an incident from a breach with 5-minute escalation deadline
    - Verify it copies breach data (zone_id, severity, breach_type) to the incident
    - Verify it sets video_archive_ref based on breach snapshot_ref
    - Verify it returns the created incident with 201 status code
    - If endpoint is missing or incomplete, implement it in `backend/app/intellivision/perimeter/routes.py`
    - _Requirements: 8.2, 2.1_
  
  - [x] 2.6 Verify GET /depot/vision/cameras/video-library/{filename}/stream endpoint
    - Test the endpoint returns FileResponse with Accept-Ranges header
    - Verify it handles HTTP Range requests and returns 206 Partial Content
    - Verify it returns 404 when video file doesn't exist
    - Verify it properly handles URL-encoded filenames with spaces (e.g., "Theft%20Camera%20.mp4")
    - If endpoint is missing or incomplete, implement it in `backend/app/intellivision/cameras/routes.py`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 3. Checkpoint - Verify backend is ready
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Create frontend service layer for depot perimeter API
  - [ ] 4.1 Create depotPerimeter service module
    - Create `frontend/src/services/depotPerimeter.ts` file
    - Import the existing API client (axios instance)
    - Define TypeScript interfaces: IncidentResponse, BreachResponse
    - _Requirements: 1.1, 10.2_
  
  - [ ] 4.2 Implement getIncidents function
    - Create async function that accepts optional status and severity filters
    - Build query string from filter parameters
    - Call GET `/depot/vision/perimeter/incidents` with query params
    - Return typed IncidentResponse array
    - _Requirements: 1.1_
  
  - [ ] 4.3 Implement getActiveBreaches function
    - Create async function with no parameters
    - Call GET `/depot/vision/perimeter/breaches/active`
    - Return typed BreachResponse array
    - _Requirements: 10.2_
  
  - [ ] 4.4 Implement acknowledgeIncident function
    - Create async function accepting incidentId and reason parameters
    - Call PATCH `/depot/vision/perimeter/incidents/{incidentId}/acknowledge` with reason in body
    - Return typed IncidentResponse
    - _Requirements: 6.2_
  
  - [ ] 4.5 Implement resolveIncident function
    - Create async function accepting incidentId and resolutionNotes parameters
    - Call PATCH `/depot/vision/perimeter/incidents/{incidentId}/resolve` with resolution_notes in body
    - Return typed IncidentResponse
    - _Requirements: 7.4_
  
  - [ ] 4.6 Implement createIncidentFromBreach function
    - Create async function accepting breachId parameter
    - Call POST `/depot/vision/perimeter/incidents/from-breach/{breachId}`
    - Return typed IncidentResponse
    - _Requirements: 8.2_

- [ ] 5. Integrate incidents data into frontend
  - [ ] 5.1 Add state management for incidents and breaches
    - In `frontend/src/app/depot/incidents/page.tsx`, add useState hooks for: incidents (Incident[]), rawIncidents (IncidentResponse[]), breaches (BreachResponse[]), acknowledging (string | null), ackError (string | null)
    - Define Incident interface for UI model with fields: id, type, sev, loc, t, status, cam, desc, assignee
    - _Requirements: 1.1, 10.2_
  
  - [ ] 5.2 Implement fetchIncidents function
    - Create useCallback function that calls getIncidents() from service layer
    - Map each IncidentResponse to Incident UI model using severity mapping (critical→CRITICAL, high→HIGH, medium→MEDIUM, low→LOW) and status mapping (open→open, acknowledged→acknowledged, escalated→acknowledged, resolved→resolved)
    - Format timestamp as "MMM DD, HH:MM"
    - Format location as "Zone ID: {zone_id}"
    - Set camera reference to video_archive_ref or "—" if null
    - Set assignee to acknowledged_by or escalated_to or "—" if both null
    - Update both rawIncidents and incidents state
    - _Requirements: 1.1, 1.2, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_
  
  - [ ] 5.3 Implement fetchBreaches function
    - Create useCallback function that calls getActiveBreaches() from service layer
    - Update breaches state with response
    - _Requirements: 10.2, 10.3_
  
  - [ ] 5.4 Add polling mechanism
    - Create useEffect that calls fetchIncidents() and fetchBreaches() on mount
    - Set up setInterval to call both functions every 20 seconds
    - Return cleanup function that clears the interval
    - Add fetchIncidents and fetchBreaches to dependency array
    - _Requirements: 1.4, 10.5_
  
  - [ ] 5.5 Create incidentByBreachId mapping
    - Create useMemo that builds a Map from breach_id to IncidentResponse
    - Use this map to determine if a breach has a linked incident
    - _Requirements: 8.5_

- [ ] 6. Implement incident card display
  - [ ] 6.1 Update incident card rendering
    - Modify the incident card component to display: title, severity badge (with colors: CRITICAL→#EF4444, HIGH→#F97316, MEDIUM→#F5A623, LOW→#22D3A1), status badge (with colors: open→#F5A623, acknowledged→#5B9BF5, resolved→#22D3A1), timestamp, camera reference, description, location, assignee
    - Add left border color matching severity
    - Add hover effect with shadow
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_
  
  - [ ] 6.2 Add empty state for incidents
    - When incidents array is empty, display empty state message
    - Show appropriate message like "No incidents found"
    - _Requirements: 1.3_

- [ ] 7. Implement incident statistics
  - [ ] 7.1 Calculate statistics with useMemo
    - Create useMemo hooks for: cntOpen (count of status="open"), cntAck (count of status="acknowledged"), cntRes (count of status="resolved"), cntCrit (count of sev="CRITICAL")
    - Each useMemo should depend on incidents array
    - _Requirements: 11.2, 11.3, 11.4, 11.5_
  
  - [ ] 7.2 Update statistics cards display
    - Update the 4 statistic cards at the top of the page with computed counts
    - Apply colors: Open→#F5A623, Acknowledged→#5B9BF5, Resolved→#22D3A1, Critical→#F04A4A
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

- [ ] 8. Implement incident filtering
  - [ ] 8.1 Add filter state management
    - Add useState for filter with type: "all" | "open" | "acknowledged" | "resolved" | "CRITICAL" | "HIGH"
    - Initialize to "all"
    - _Requirements: 9.1_
  
  - [ ] 8.2 Implement filter logic
    - Create useMemo that filters incidents based on current filter
    - If filter is "all", return all incidents
    - If filter matches status (open, acknowledged, resolved), filter by status
    - If filter matches severity (CRITICAL, HIGH), filter by severity
    - _Requirements: 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_
  
  - [ ] 8.3 Update filter buttons
    - Add onClick handlers to filter buttons that call setFilter
    - Highlight active filter button with orange border and background
    - _Requirements: 9.1, 9.9_

- [ ] 9. Implement video analysis modal
  - [ ] 9.1 Add video modal state
    - Add useState for selectedBreachVideo with type: { breachId: string, videoFile: string, breachType: string } | null
    - Initialize to null (modal closed)
    - _Requirements: 3.2_
  
  - [ ] 9.2 Create breach type to video file mapping
    - Define BREACH_VIDEO_MAP constant with mappings: unauthorized_entry→Perimeter_Detection.mp4, loitering→Theft Camera .mp4, forced_entry→Perimeter_Detection.mp4, after_hours→Perimeter_Detection.mp4, object_left→Theft Camera .mp4, unknown→LPR_RECOGNITION.mp4
    - _Requirements: 2.4, 3.3_
  
  - [ ] 9.3 Implement handleAnalysisClick function
    - Create function that accepts breach or incident parameter
    - Determine video filename from breach_type using BREACH_VIDEO_MAP or use video_archive_ref
    - Set selectedBreachVideo state with breachId, videoFile, and breachType
    - _Requirements: 3.2, 3.3, 3.5_
  
  - [ ] 9.4 Create video analysis modal component
    - Create modal overlay with backdrop
    - Add HTML5 video element with controls and autoPlay attributes
    - Construct video URL as `/backend/depot/vision/cameras/video-library/${encodeURIComponent(videoFile)}/stream`
    - Add close button and click-outside-to-close functionality
    - Style with max-height: 70vh for responsive sizing
    - Add key attribute to video element to force remount when video changes
    - _Requirements: 3.2, 3.4, 4.1_
  
  - [ ] 9.5 Add Analysis button to incident cards
    - Add "Analysis" button to incident cards when video evidence is available
    - Button should call handleAnalysisClick with the incident
    - _Requirements: 3.1, 3.2_

- [ ] 10. Implement breach card display
  - [ ] 10.1 Create breach type label mapping
    - Define BREACH_TYPE_LABELS constant with human-readable labels: unauthorized_entry→"Unauthorized Entry", loitering→"Loitering", forced_entry→"Forced Entry", after_hours→"After Hours", object_left→"Object Left Behind", unknown→"Unknown"
    - _Requirements: 10.3_
  
  - [ ] 10.2 Update breach card rendering
    - Modify breach card component to display: breach type label (using BREACH_TYPE_LABELS), severity badge, timestamp, camera reference, notes (if available), zone ID, alert sent indicator
    - Add Analysis button that calls handleAnalysisClick
    - _Requirements: 10.3, 10.6_
  
  - [ ] 10.3 Add empty state for breaches
    - When breaches array is empty, display "All Clear" message with "No active perimeter breaches detected" text
    - _Requirements: 10.4_

- [ ] 11. Implement incident acknowledgement workflow
  - [ ] 11.1 Implement acknowledge function for incidents
    - Create async function that accepts incident ID
    - Set acknowledging state to incident ID (for loading state)
    - Call acknowledgeIncident service with reason "Acknowledged from incident console"
    - On success, call fetchIncidents to refresh data
    - On error, set ackError state with message "Unable to acknowledge this incident. The displayed data was not changed."
    - Clear acknowledging state in finally block
    - _Requirements: 6.2, 6.3, 6.4, 6.5_
  
  - [ ] 11.2 Add Acknowledge button to incident cards
    - Show "Acknowledge" button only when status is "open"
    - Button should call acknowledge function with incident ID
    - Show "Acknowledging..." text when acknowledging state matches incident ID
    - Disable button during acknowledgement
    - Hide button when status is "acknowledged" or "resolved"
    - _Requirements: 6.1, 6.5, 6.6_

- [ ] 12. Implement incident resolution workflow
  - [ ] 12.1 Add resolution modal state
    - Add useState for resolveModalId (string | null) to track which incident is being resolved
    - Add useState for resolveNotes (string) to store resolution notes
    - Add useState for resolving (boolean) for loading state
    - _Requirements: 7.2_
  
  - [ ] 12.2 Create resolution modal component
    - Create modal with text area for resolution notes
    - Add character count validation (minimum 5 characters)
    - Add Submit button (disabled until notes are valid)
    - Add Cancel button that closes modal
    - Show loading state during submission
    - _Requirements: 7.2, 7.3_
  
  - [ ] 12.3 Implement handleResolve function
    - Create async function that validates resolution notes (min 5 characters)
    - Set resolving state to true
    - Call resolveIncident service with incident ID and resolution notes
    - On success, call fetchIncidents to refresh data and close modal
    - On error, keep modal open and allow retry
    - Clear resolving state in finally block
    - _Requirements: 7.4, 7.5, 7.6_
  
  - [ ] 12.4 Add Resolve button to incident cards
    - Show "Resolve" button when status is "open" or "acknowledged"
    - Button should open resolution modal by setting resolveModalId
    - Hide button when status is "resolved"
    - _Requirements: 7.1, 7.7_

- [ ] 13. Implement breach acknowledgement workflow
  - [ ] 13.1 Implement acknowledgeBreach function
    - Create async function that accepts breach parameter
    - Set acknowledging state to breach ID (for loading state)
    - Call createIncidentFromBreach service to create incident from breach
    - On success, call acknowledgeIncident service with reason "Acknowledged from active perimeter breach card"
    - On success, call both fetchIncidents and fetchBreaches to refresh data
    - On error, set ackError state with appropriate message
    - Clear acknowledging state in finally block
    - _Requirements: 8.2, 8.3, 8.4_
  
  - [ ] 13.2 Add Acknowledge button to breach cards
    - Show "Acknowledge" button when breach has no linked incident
    - Show "Acknowledged" text (disabled) when linked incident exists with status "acknowledged"
    - Button should call acknowledgeBreach function with breach
    - Show "Acknowledging..." text when acknowledging state matches breach ID
    - Disable button during acknowledgement
    - _Requirements: 8.1, 8.5, 8.6_

- [ ] 14. Final checkpoint - Verify all functionality
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- The implementation uses TypeScript for frontend and Python for backend
- Video streaming relies on FastAPI's FileResponse automatic HTTP Range request handling
- All API calls use the existing service layer pattern with axios
- State management uses React hooks (useState, useEffect, useMemo, useCallback)
- The design does not include property-based tests as this is primarily a data integration and UI feature

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3", "2.1", "2.2", "2.6"] },
    { "id": 3, "tasks": ["2.3", "2.4", "2.5", "4.1"] },
    { "id": 4, "tasks": ["4.2", "4.3", "4.4", "4.5", "4.6"] },
    { "id": 5, "tasks": ["5.1"] },
    { "id": 6, "tasks": ["5.2", "5.3"] },
    { "id": 7, "tasks": ["5.4", "5.5", "6.1", "7.1", "8.1", "9.1", "9.2", "10.1"] },
    { "id": 8, "tasks": ["6.2", "7.2", "8.2", "9.3", "10.2", "12.1"] },
    { "id": 9, "tasks": ["8.3", "9.4", "10.3", "11.1", "12.2"] },
    { "id": 10, "tasks": ["9.5", "11.2", "12.3", "13.1"] },
    { "id": 11, "tasks": ["12.4", "13.2"] }
  ]
}
```
