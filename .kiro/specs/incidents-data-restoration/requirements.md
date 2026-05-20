# Requirements Document

## Introduction

The Incidents page at `/depot/incidents` currently displays minimal or empty incident data despite having a complete UI framework, backend APIs, and seed data available. This feature will restore full incident management functionality by populating the incidents list with actual data from the backend, linking incidents to video evidence files, adding video analysis capabilities to incident cards (currently only available on breach cards), and ensuring all incident workflows (acknowledgement, resolution, escalation) work with real data.

The system will display two main sections: "Incidents & Alerts" (top section showing all incidents with filtering) and "Active Perimeter Breaches" (bottom section showing real-time perimeter breaches). Each incident will show severity, status, location, camera reference, timestamps, assignee, and provide actions for viewing evidence, acknowledging, and resolving. Video analysis will be available for both incidents and breaches, streaming from the backend video library with proper HTTP Range request support.

## Glossary

- **Incident_System**: The frontend and backend components responsible for managing security incidents, alerts, and perimeter breaches
- **Incidents_Page**: The React component at `/depot/incidents` that displays incidents and breaches
- **Backend_API**: The FastAPI endpoints at `/depot/vision/perimeter/incidents` and `/depot/vision/perimeter/breaches`
- **Video_Library**: The backend video storage system at `/depot/vision/cameras/video-library/{filename}/stream`
- **Incident_Card**: A UI component displaying a single incident with metadata and action buttons
- **Breach_Card**: A UI component displaying a single perimeter breach with metadata and action buttons
- **Analysis_Modal**: A modal dialog containing an HTML5 video player for streaming incident/breach analysis videos
- **Seed_Data**: The sample incident data defined in `seed_intelliops.py` with 5 incidents
- **Video_Evidence**: Video files stored in the backend video library (Perimeter_Detection.mp4, Theft Camera .mp4, LPR_RECOGNITION.mp4)
- **Incident_Metadata**: Severity, status, location, camera reference, timestamps, assignee, description
- **HTTP_Range_Request**: HTTP protocol feature for partial content delivery required by HTML5 video players

## Requirements

### Requirement 1: Populate Incidents List with Backend Data

**User Story:** As a security operator, I want to see all incidents from the backend displayed on the Incidents page, so that I can monitor and respond to security events.

#### Acceptance Criteria

1. WHEN the Incidents_Page loads, THE Incident_System SHALL fetch incidents from Backend_API endpoint `/depot/vision/perimeter/incidents`
2. WHEN the Backend_API returns incident data, THE Incident_System SHALL map each backend incident to the UI Incident_Card format with all Incident_Metadata fields
3. WHEN the incident list is empty, THE Incident_System SHALL display an empty state message instead of showing stale or mock data
4. THE Incident_System SHALL poll the Backend_API every 20 seconds to refresh incident data
5. WHEN the Backend_API returns incidents with different severity levels (critical, high, medium, low), THE Incident_System SHALL correctly map them to UI severity badges with appropriate colors

### Requirement 2: Link Incidents to Video Evidence

**User Story:** As a security operator, I want each incident to reference its associated video evidence, so that I can review footage related to the incident.

#### Acceptance Criteria

1. WHEN an incident is created from a perimeter breach, THE Backend_API SHALL populate the `video_archive_ref` field with the breach's snapshot reference
2. WHEN an Incident_Card displays an incident with a non-null `video_archive_ref`, THE Incident_System SHALL display the camera reference in the format "📷 {video_archive_ref}"
3. WHEN an incident has no video evidence (video_archive_ref is null), THE Incident_System SHALL display "—" instead of a camera reference
4. THE Incident_System SHALL map breach types to video filenames using the mapping: unauthorized_entry → Perimeter_Detection.mp4, loitering → Theft Camera .mp4, forced_entry → Perimeter_Detection.mp4, after_hours → Perimeter_Detection.mp4, object_left → Theft Camera .mp4, unknown → LPR_RECOGNITION.mp4

### Requirement 3: Add Analysis Button to Incident Cards

**User Story:** As a security operator, I want to click an "Analysis" button on incident cards to view video evidence, so that I can investigate incidents with visual context.

#### Acceptance Criteria

1. WHEN an Incident_Card is rendered with video evidence available, THE Incident_System SHALL display an "Analysis" button alongside the existing action buttons
2. WHEN a user clicks the "Analysis" button on an Incident_Card, THE Incident_System SHALL open the Analysis_Modal with the video player
3. WHEN the Analysis_Modal opens for an incident, THE Incident_System SHALL determine the video filename based on the incident's breach type or video_archive_ref
4. WHEN the video filename contains special characters (e.g., spaces), THE Incident_System SHALL percent-encode the filename using `encodeURIComponent` before constructing the video URL
5. WHEN an incident has no associated breach type or video evidence, THE Incident_System SHALL use "Perimeter_Detection.mp4" as the default video file

### Requirement 4: Stream Video Evidence with HTTP Range Support

**User Story:** As a security operator, I want video evidence to load and play smoothly in the browser, so that I can review footage without technical issues.

#### Acceptance Criteria

1. WHEN the Analysis_Modal requests a video stream, THE Video_Library SHALL construct the video URL as `/backend/depot/vision/cameras/video-library/{encoded_filename}/stream`
2. WHEN the HTML5 video player sends an HTTP Range request, THE Backend_API SHALL respond with status code 206 (Partial Content) and include the `Content-Range` header
3. WHEN the HTML5 video player sends a non-range request, THE Backend_API SHALL respond with status code 200 and the complete video file
4. THE Backend_API SHALL set the `Accept-Ranges: bytes` header in all video stream responses
5. WHEN the video file does not exist on the backend filesystem, THE Backend_API SHALL return status code 404 and THE Analysis_Modal SHALL display a user-friendly error message

### Requirement 5: Display Incident Metadata

**User Story:** As a security operator, I want to see complete metadata for each incident, so that I can assess priority and context at a glance.

#### Acceptance Criteria

1. WHEN an Incident_Card is rendered, THE Incident_System SHALL display the incident title as the primary heading
2. WHEN an Incident_Card is rendered, THE Incident_System SHALL display severity badge with color coding (CRITICAL: #EF4444, HIGH: #F97316, MEDIUM: #F5A623, LOW: #22D3A1)
3. WHEN an Incident_Card is rendered, THE Incident_System SHALL display status badge with color coding (open: #F5A623, acknowledged: #5B9BF5, resolved: #22D3A1)
4. WHEN an Incident_Card is rendered, THE Incident_System SHALL display the timestamp in format "MMM DD, HH:MM"
5. WHEN an Incident_Card is rendered, THE Incident_System SHALL display the location as "Zone ID: {zone_id}"
6. WHEN an Incident_Card is rendered, THE Incident_System SHALL display the assignee (acknowledged_by or escalated_to) or "—" if unassigned
7. WHEN an Incident_Card is rendered, THE Incident_System SHALL display the incident description

### Requirement 6: Implement Incident Acknowledgement Workflow

**User Story:** As a security operator, I want to acknowledge incidents to indicate I am handling them, so that other operators know the incident is being addressed.

#### Acceptance Criteria

1. WHEN an Incident_Card displays an incident with status "open", THE Incident_System SHALL display an "Acknowledge" button
2. WHEN a user clicks the "Acknowledge" button, THE Incident_System SHALL call Backend_API endpoint `PATCH /depot/vision/perimeter/incidents/{incident_id}/acknowledge` with reason "Acknowledged from incident console"
3. WHEN the acknowledgement API call succeeds, THE Incident_System SHALL refresh the incidents list to show updated status
4. WHEN the acknowledgement API call fails, THE Incident_System SHALL display an error message "Unable to acknowledge this incident. The displayed data was not changed."
5. WHEN an acknowledgement is in progress, THE Incident_System SHALL disable the "Acknowledge" button and display "Acknowledging..." text
6. WHEN an Incident_Card displays an incident with status "acknowledged" or "resolved", THE Incident_System SHALL NOT display an "Acknowledge" button

### Requirement 7: Implement Incident Resolution Workflow

**User Story:** As a security operator, I want to resolve incidents with resolution notes, so that I can close incidents and document the outcome.

#### Acceptance Criteria

1. WHEN an Incident_Card displays an incident with status "open" or "acknowledged", THE Incident_System SHALL display a "Resolve" button
2. WHEN a user clicks the "Resolve" button, THE Incident_System SHALL open a resolution modal with a text area for resolution notes
3. WHEN the resolution modal is open, THE Incident_System SHALL require a minimum of 5 characters in the resolution notes field
4. WHEN a user submits resolution notes, THE Incident_System SHALL call Backend_API endpoint `PATCH /depot/vision/perimeter/incidents/{incident_id}/resolve` with the resolution notes
5. WHEN the resolution API call succeeds, THE Incident_System SHALL refresh the incidents list and close the resolution modal
6. WHEN the resolution API call fails, THE Incident_System SHALL keep the modal open and allow the user to retry
7. WHEN an Incident_Card displays an incident with status "resolved", THE Incident_System SHALL NOT display a "Resolve" button

### Requirement 8: Implement Breach Acknowledgement Workflow

**User Story:** As a security operator, I want to acknowledge perimeter breaches to create incidents and track them, so that breaches are properly escalated and managed.

#### Acceptance Criteria

1. WHEN a Breach_Card displays a breach without a linked incident, THE Incident_System SHALL display an "Acknowledge" button
2. WHEN a user clicks the "Acknowledge" button on a Breach_Card, THE Incident_System SHALL call Backend_API endpoint `POST /depot/vision/perimeter/incidents/from-breach/{breach_id}` to create an incident
3. WHEN the incident creation succeeds, THE Incident_System SHALL call Backend_API endpoint `PATCH /depot/vision/perimeter/incidents/{incident_id}/acknowledge` with reason "Acknowledged from active perimeter breach card"
4. WHEN the breach acknowledgement workflow completes, THE Incident_System SHALL refresh both incidents and breaches lists
5. WHEN a Breach_Card displays a breach with a linked incident that has status "acknowledged", THE Incident_System SHALL display "Acknowledged" text instead of the "Acknowledge" button and disable the button
6. WHEN a breach acknowledgement is in progress, THE Incident_System SHALL disable the "Acknowledge" button and display "Acknowledging..." text

### Requirement 9: Implement Incident Filtering

**User Story:** As a security operator, I want to filter incidents by status and severity, so that I can focus on specific types of incidents.

#### Acceptance Criteria

1. THE Incident_System SHALL display filter buttons for: All, Open, Acknowledged, Resolved, Critical, High
2. WHEN a user clicks a filter button, THE Incident_System SHALL update the displayed incidents to show only those matching the filter
3. WHEN the "All" filter is active, THE Incident_System SHALL display all incidents regardless of status or severity
4. WHEN the "Open" filter is active, THE Incident_System SHALL display only incidents with status "open"
5. WHEN the "Acknowledged" filter is active, THE Incident_System SHALL display only incidents with status "acknowledged"
6. WHEN the "Resolved" filter is active, THE Incident_System SHALL display only incidents with status "resolved"
7. WHEN the "Critical" filter is active, THE Incident_System SHALL display only incidents with severity "CRITICAL"
8. WHEN the "High" filter is active, THE Incident_System SHALL display only incidents with severity "HIGH"
9. THE Incident_System SHALL highlight the active filter button with orange border and background

### Requirement 10: Display Active Perimeter Breaches

**User Story:** As a security operator, I want to see active perimeter breaches in a dedicated section, so that I can respond to real-time security threats.

#### Acceptance Criteria

1. THE Incidents_Page SHALL display an "Active Perimeter Breaches" section below the incidents list
2. WHEN the Incidents_Page loads, THE Incident_System SHALL fetch breaches from Backend_API endpoint `/depot/vision/perimeter/breaches/active`
3. WHEN the Backend_API returns breach data, THE Incident_System SHALL display each breach in a Breach_Card with severity badge, breach type label, timestamp, camera reference, and zone ID
4. WHEN the breaches list is empty, THE Incident_System SHALL display "All Clear" message with "No active perimeter breaches detected" text
5. THE Incident_System SHALL poll the Backend_API every 20 seconds to refresh breach data
6. WHEN a Breach_Card is rendered, THE Incident_System SHALL display an "Analysis" button that opens the Analysis_Modal with the appropriate video file

### Requirement 11: Display Incident Statistics

**User Story:** As a security operator, I want to see summary statistics of incidents, so that I can understand the overall security situation at a glance.

#### Acceptance Criteria

1. THE Incidents_Page SHALL display four statistic cards at the top: Open, Acknowledged, Resolved, Critical
2. WHEN incidents are loaded, THE Incident_System SHALL calculate the count of incidents with status "open" and display it in the "Open" card with color #F5A623
3. WHEN incidents are loaded, THE Incident_System SHALL calculate the count of incidents with status "acknowledged" and display it in the "Acknowledged" card with color #5B9BF5
4. WHEN incidents are loaded, THE Incident_System SHALL calculate the count of incidents with status "resolved" and display it in the "Resolved" card with color #22D3A1
5. WHEN incidents are loaded, THE Incident_System SHALL calculate the count of incidents with severity "CRITICAL" and display it in the "Critical" card with color #F04A4A
6. THE Incident_System SHALL update these statistics automatically when the incidents list is refreshed

### Requirement 12: Seed Incident Data

**User Story:** As a developer, I want to populate the database with sample incident data, so that the Incidents page displays realistic data for demonstration and testing.

#### Acceptance Criteria

1. THE Seed_Data script SHALL create 5 sample incidents with diverse properties: SLA breach (P1, cold chain), unauthorized vehicle (perimeter), dwell time alert (alert source), equipment malfunction (P3, sensor), fire alarm (sensor)
2. WHEN the Seed_Data script runs, THE Backend_API SHALL accept incident creation requests and store them in the database
3. WHEN incidents are created from Seed_Data, THE Incident_System SHALL assign appropriate severity levels (critical, high, medium, low) based on the incident type
4. WHEN incidents are created from Seed_Data, THE Incident_System SHALL assign appropriate source types (sla_breach, perimeter, alert, sensor)
5. WHEN incidents are created from Seed_Data, THE Incident_System SHALL assign zone IDs corresponding to depot zones (Cold Storage, Inbound Gate, Staging Area, Dispatch Bay)
