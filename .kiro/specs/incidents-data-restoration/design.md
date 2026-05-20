# Design Document: Incidents Data Restoration

## Overview

The Incidents Data Restoration feature restores full functionality to the `/depot/incidents` page by integrating the existing UI framework with backend APIs and real incident data. The system displays two main sections: "Incidents & Alerts" showing all security incidents with filtering and workflow actions, and "Active Perimeter Breaches" showing real-time perimeter breach events. Each incident and breach provides video evidence streaming capabilities with HTTP Range request support for smooth HTML5 video playback.

### Key Capabilities

- **Real-time Data Integration**: Fetch and display incidents and breaches from backend APIs with 20-second polling
- **Video Evidence Streaming**: Stream video files from backend video library with HTTP Range support for seeking
- **Incident Workflows**: Acknowledge and resolve incidents with proper state transitions
- **Breach-to-Incident Escalation**: Create incidents from perimeter breaches and acknowledge them
- **Filtering and Statistics**: Filter incidents by status/severity and display summary statistics
- **Seed Data Population**: Populate database with realistic sample incidents for demonstration

### Technology Stack

- **Frontend**: React 18+ with TypeScript, Next.js App Router
- **Backend**: FastAPI with Python 3.11+, PostgreSQL database
- **Video Streaming**: HTTP Range requests with FileResponse
- **State Management**: React hooks (useState, useEffect, useMemo, useCallback)
- **API Communication**: Axios with custom API service layer

## Architecture

### System Architecture

```mermaid
graph TB
    subgraph "Frontend Layer"
        UI[IncidentsPage Component]
        Service[depotPerimeter Service]
        Modal[Analysis Modal]
    end
    
    subgraph "Backend Layer"
        API[FastAPI Router]
        DB[(PostgreSQL)]
        VideoLib[Video Library]
    end
    
    UI -->|API Calls| Service
    Service -->|HTTP Requests| API
    API -->|Query/Update| DB
    Modal -->|Video Stream Request| API
    API -->|File Stream| VideoLib
    
    UI -->|Poll every 20s| Service
    Service -->|GET /incidents| API
    Service -->|GET /breaches/active| API
    Service -->|PATCH /incidents/{id}/acknowledge| API
    Service -->|PATCH /incidents/{id}/resolve| API
    Service -->|POST /incidents/from-breach/{id}| API
```

### Data Flow

1. **Initial Load**:
   - IncidentsPage mounts → fetchIncidents() + fetchBreaches()
   - Service layer calls backend APIs
   - Backend queries database and returns JSON responses
   - Frontend maps backend data to UI models
   - UI renders incident cards and breach cards

2. **Polling Updates**:
   - setInterval triggers every 20 seconds
   - Fetch incidents and breaches again
   - Update state with new data
   - React re-renders affected components

3. **Incident Acknowledgement**:
   - User clicks "Acknowledge" button
   - Frontend calls acknowledgeIncident(id, reason)
   - Backend updates incident status to "acknowledged"
   - Frontend refreshes incident list
   - UI shows updated status badge

4. **Video Streaming**:
   - User clicks "Analysis" button
   - Modal opens with video player
   - Video player requests: `/backend/depot/vision/cameras/video-library/{filename}/stream`
   - Backend returns FileResponse with Accept-Ranges header
   - Browser sends Range requests for video chunks
   - Backend responds with 206 Partial Content

### Component Architecture

```mermaid
graph TD
    IncidentsPage[IncidentsPage]
    
    IncidentsPage --> Stats[Statistics Cards]
    IncidentsPage --> Filters[Filter Buttons]
    IncidentsPage --> IncidentList[Incident List]
    IncidentsPage --> BreachList[Breach List]
    IncidentsPage --> VideoModal[Video Analysis Modal]
    IncidentsPage --> ResolveModal[Resolve Modal]
    
    IncidentList --> IncidentCard1[Incident Card]
    IncidentList --> IncidentCard2[Incident Card]
    IncidentList --> IncidentCardN[...]
    
    BreachList --> BreachCard1[Breach Card]
    BreachList --> BreachCard2[Breach Card]
    BreachList --> BreachCardN[...]
    
    IncidentCard1 --> IncidentActions[View Evidence, Acknowledge, Resolve]
    BreachCard1 --> BreachActions[Analysis, Acknowledge]
```

## Components and Interfaces

### Frontend Components

#### IncidentsPage Component

**Purpose**: Main container component managing incidents and breaches display

**State Management**:
```typescript
const [incidents, setIncidents] = useState<Incident[]>([])
const [rawIncidents, setRawIncidents] = useState<IncidentResponse[]>([])
const [breaches, setBreaches] = useState<BreachResponse[]>([])
const [filter, setFilter] = useState<FilterType>("all")
const [resolveModalId, setResolveModalId] = useState<string | null>(null)
const [resolveNotes, setResolveNotes] = useState("")
const [acknowledging, setAcknowledging] = useState<string | null>(null)
const [ackError, setAckError] = useState<string | null>(null)
const [resolving, setResolving] = useState(false)
const [selectedBreachVideo, setSelectedBreachVideo] = useState<{
  breachId: string
  videoFile: string
  breachType: string
} | null>(null)
```

**Key Functions**:
- `fetchIncidents()`: Fetch incidents from backend and map to UI format
- `fetchBreaches()`: Fetch active breaches from backend
- `acknowledge(id)`: Acknowledge an incident
- `acknowledgeBreach(breach)`: Create incident from breach and acknowledge it
- `handleResolve()`: Resolve an incident with notes
- `handleAnalysisClick(breach)`: Open video modal for breach analysis

**Computed Values**:
- `filtered`: Incidents filtered by current filter selection
- `cntOpen`, `cntAck`, `cntRes`, `cntCrit`: Statistics counts
- `incidentByBreachId`: Map of breach IDs to incidents for linking

#### Incident Card

**Purpose**: Display individual incident with metadata and actions

**Props**:
```typescript
interface IncidentCardProps {
  incident: Incident
  onAcknowledge: (id: string) => void
  onResolve: (id: string) => void
  acknowledging: string | null
}
```

**Display Elements**:
- Title (incident type)
- Severity badge (color-coded)
- Status badge (color-coded)
- Timestamp (formatted)
- Camera reference (if available)
- Description
- Location (zone ID)
- Assignee
- Action buttons (View Evidence, Acknowledge, Resolve)

**Styling**:
- Left border color matches severity
- Hover effect with shadow
- Responsive layout with flexbox

#### Breach Card

**Purpose**: Display individual perimeter breach with metadata and actions

**Props**:
```typescript
interface BreachCardProps {
  breach: BreachResponse
  linkedIncident?: IncidentResponse
  onAcknowledge: (breach: BreachResponse) => void
  onAnalysis: (breach: BreachResponse) => void
  acknowledging: string | null
}
```

**Display Elements**:
- Breach type label (human-readable)
- Severity badge (color-coded)
- Analysis button
- Acknowledge button (or "Acknowledged" text if linked incident exists)
- Timestamp
- Camera reference
- Notes (if available)
- Zone ID
- Alert sent indicator

#### Video Analysis Modal

**Purpose**: Display video evidence in a modal dialog with HTML5 video player

**Props**:
```typescript
interface VideoModalProps {
  breachId: string
  videoFile: string
  breachType: string
  onClose: () => void
}
```

**Features**:
- Full-screen overlay with backdrop
- Video player with controls (play, pause, seek, volume, fullscreen)
- Auto-play on open
- Responsive sizing (max-height: 70vh)
- Close button
- Click outside to close

**Video URL Construction**:
```typescript
const videoUrl = `/backend/depot/vision/cameras/video-library/${encodeURIComponent(videoFile)}/stream`
```

#### Resolve Modal

**Purpose**: Collect resolution notes when resolving an incident

**Props**:
```typescript
interface ResolveModalProps {
  incidentId: string
  onResolve: (notes: string) => void
  onCancel: () => void
  resolving: boolean
}
```

**Features**:
- Text area for resolution notes (min 5 characters)
- Character count validation
- Submit button (disabled until valid)
- Cancel button
- Loading state during submission

### Backend Components

#### Perimeter Router (`/depot/vision/perimeter`)

**Endpoints**:

1. **GET /incidents**
   - Query params: `status` (optional), `severity` (optional)
   - Returns: `List[IncidentResponse]`
   - Filters incidents by status and/or severity

2. **GET /incidents/active**
   - Returns: `List[IncidentResponse]`
   - Returns incidents with status "open" or "acknowledged"

3. **POST /incidents/from-breach/{breach_id}**
   - Path param: `breach_id` (UUID)
   - Returns: `IncidentResponse` (201 Created)
   - Creates incident from breach with 5-minute escalation deadline

4. **PATCH /incidents/{incident_id}/acknowledge**
   - Path param: `incident_id` (UUID)
   - Body: `{ "reason": string }`
   - Returns: `IncidentResponse`
   - Updates status to "acknowledged", sets acknowledged_at and acknowledged_by

5. **PATCH /incidents/{incident_id}/resolve**
   - Path param: `incident_id` (UUID)
   - Body: `{ "resolution_notes": string }`
   - Returns: `IncidentResponse`
   - Updates status to "resolved", sets resolved_at, resolved_by, resolution_notes

6. **GET /breaches/active**
   - Returns: `List[BreachResponse]`
   - Returns breaches where resolved_at is null

#### Video Library Router (`/depot/vision/cameras`)

**Endpoint**:

**GET /video-library/{filename}/stream**
- Path param: `filename` (string, URL-encoded)
- Returns: `FileResponse` with video/mp4 content type
- Headers:
  - `Accept-Ranges: bytes`
  - `Cache-Control: no-cache`
- Supports HTTP Range requests (206 Partial Content)
- Returns 404 if file not found

**Implementation**:
```python
@router.get("/video-library/{filename}/stream")
async def stream_video_file(filename: str):
    video_path = get_local_video_path(filename)
    if video_path is None or not os.path.exists(video_path):
        raise HTTPException(status_code=404, detail=f"Video not found: {filename}")
    
    return FileResponse(
        path=str(video_path),
        media_type="video/mp4",
        headers={
            "Accept-Ranges": "bytes",
            "Cache-Control": "no-cache",
        },
    )
```

**Note**: FastAPI's FileResponse automatically handles HTTP Range requests and returns 206 Partial Content when the client sends a Range header.


## Data Models

### Frontend Data Models

#### Incident (UI Model)

```typescript
interface Incident {
  id: string
  type: string          // Incident title
  sev: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
  loc: string           // Formatted location (e.g., "Zone ID: abc123")
  t: string             // Formatted timestamp
  status: "open" | "acknowledged" | "resolved"
  cam: string           // Camera reference or "—"
  desc: string          // Description
  assignee: string      // Acknowledged by or escalated to, or "—"
}
```

#### IncidentResponse (Backend Model)

```typescript
interface IncidentResponse {
  id: string
  breach_id: string
  zone_id: string
  severity: "critical" | "high" | "medium" | "low"
  title: string
  description: string | null
  escalation_level: number
  escalation_deadline: string | null  // ISO datetime
  escalated_to: string | null
  status: "open" | "acknowledged" | "escalated" | "resolved"
  acknowledged_at: string | null      // ISO datetime
  acknowledged_by: string | null
  resolved_at: string | null          // ISO datetime
  resolved_by: string | null
  resolution_notes: string | null
  video_archive_ref: string | null
  created_at: string                  // ISO datetime
}
```

#### BreachResponse (Backend Model)

```typescript
interface BreachResponse {
  id: string
  zone_id: string
  camera_id: string | null
  breach_type: "unauthorized_entry" | "loitering" | "forced_entry" | 
               "after_hours" | "object_left" | "unknown"
  severity: "critical" | "high" | "medium" | "low"
  confidence: number | null           // 0.0 to 1.0
  snapshot_ref: string | null
  alert_sent: boolean
  notes: string | null
  detected_at: string                 // ISO datetime
  resolved_at: string | null          // ISO datetime
  resolved_by: string | null
  resolution_notes: string | null
  created_at: string                  // ISO datetime
}
```

### Backend Database Models

#### PerimeterIncident Table

```python
class PerimeterIncident(DBBaseModel):
    __tablename__ = "depot_perimeter_incidents"
    
    id: UUID (primary key)
    breach_id: UUID (foreign key, indexed)
    zone_id: UUID (indexed)
    severity: String (critical, high, medium, low)
    title: String
    description: Text (nullable)
    escalation_level: Integer (default 0)
    escalation_deadline: DateTime (timezone-aware, nullable)
    escalated_to: String (nullable)
    status: String (open, acknowledged, escalated, resolved)
    acknowledged_at: DateTime (timezone-aware, nullable)
    acknowledged_by: String (nullable)
    resolved_at: DateTime (timezone-aware, nullable)
    resolved_by: String (nullable)
    resolution_notes: Text (nullable)
    video_archive_ref: String (nullable)
    created_at: DateTime (timezone-aware, auto)
    updated_at: DateTime (timezone-aware, auto)
```

#### PerimeterBreach Table

```python
class PerimeterBreach(DBBaseModel):
    __tablename__ = "depot_perimeter_breaches"
    
    id: UUID (primary key)
    zone_id: UUID (indexed)
    camera_id: UUID (nullable, indexed)
    breach_type: String (enum)
    severity: String (enum)
    confidence: Float (nullable, 0.0-1.0)
    snapshot_ref: String (nullable)
    alert_sent: Boolean (default False)
    notes: Text (nullable)
    detected_at: DateTime (timezone-aware)
    resolved_at: DateTime (timezone-aware, nullable)
    resolved_by: String (nullable)
    resolution_notes: Text (nullable)
    created_at: DateTime (timezone-aware, auto)
    updated_at: DateTime (timezone-aware, auto)
```

### Data Mapping

#### Backend to Frontend Incident Mapping

```typescript
function mapBackendIncident(inc: IncidentResponse): Incident {
  const sevMap: Record<string, Incident["sev"]> = {
    critical: "CRITICAL",
    high: "HIGH",
    medium: "MEDIUM",
    low: "LOW",
  }
  
  const statusMap: Record<string, Incident["status"]> = {
    open: "open",
    acknowledged: "acknowledged",
    escalated: "acknowledged",  // Map escalated to acknowledged for UI
    resolved: "resolved",
  }
  
  return {
    id: inc.id,
    type: inc.title,
    sev: sevMap[inc.severity] || "MEDIUM",
    loc: `Zone ID: ${inc.zone_id}`,
    t: new Date(inc.created_at).toLocaleString([], {
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      day: "numeric"
    }),
    status: statusMap[inc.status] || "open",
    cam: inc.video_archive_ref || "—",
    desc: inc.description || inc.title,
    assignee: inc.acknowledged_by || inc.escalated_to || "—",
  }
}
```

#### Breach Type to Video File Mapping

```typescript
const BREACH_VIDEO_MAP: Record<string, string> = {
  unauthorized_entry: "Perimeter_Detection.mp4",
  loitering: "Theft Camera .mp4",
  forced_entry: "Perimeter_Detection.mp4",
  after_hours: "Perimeter_Detection.mp4",
  object_left: "Theft Camera .mp4",
  unknown: "LPR_RECOGNITION.mp4",
}
```

#### Breach Type to Label Mapping

```typescript
const BREACH_TYPE_LABELS: Record<string, string> = {
  unauthorized_entry: "Unauthorized Entry",
  loitering: "Loitering",
  forced_entry: "Forced Entry",
  after_hours: "After Hours",
  object_left: "Object Left Behind",
  unknown: "Unknown",
}
```

## Video Streaming Implementation

### HTTP Range Request Support

HTML5 video players require HTTP Range request support for seeking and progressive loading. The backend must:

1. **Accept Range Requests**: Check for `Range` header in request
2. **Return Partial Content**: Respond with 206 status code and requested byte range
3. **Include Content-Range Header**: Specify which bytes are being returned
4. **Include Accept-Ranges Header**: Indicate that range requests are supported

### FastAPI FileResponse Behavior

FastAPI's `FileResponse` automatically handles HTTP Range requests:

- When client sends `Range: bytes=0-1023`, FileResponse returns 206 with that range
- When client sends no Range header, FileResponse returns 200 with full file
- FileResponse automatically sets `Content-Range` and `Content-Length` headers
- FileResponse streams file in chunks (efficient for large files)

### Video URL Construction

Frontend constructs video URLs with proper encoding:

```typescript
const videoFile = BREACH_VIDEO_MAP[breach.breach_type] || "Perimeter_Detection.mp4"
const encodedFilename = encodeURIComponent(videoFile)
const videoUrl = `/backend/depot/vision/cameras/video-library/${encodedFilename}/stream`
```

**Why encoding is necessary**:
- Video filenames may contain spaces (e.g., "Theft Camera .mp4")
- Spaces in URLs must be encoded as `%20`
- `encodeURIComponent()` handles all special characters

### Video Player Implementation

```tsx
<video
  key={selectedBreachVideo.videoFile}
  controls
  autoPlay
  className="w-full h-auto"
  style={{ maxHeight: '70vh' }}
>
  <source
    src={`/backend/depot/vision/cameras/video-library/${encodeURIComponent(selectedBreachVideo.videoFile)}/stream`}
    type="video/mp4"
  />
  Your browser does not support the video tag.
</video>
```

**Key attributes**:
- `controls`: Show play/pause, seek bar, volume, fullscreen controls
- `autoPlay`: Start playing when modal opens
- `key`: Force remount when video file changes
- `maxHeight: 70vh`: Prevent video from exceeding viewport height

### Error Handling

**Backend**:
```python
video_path = get_local_video_path(filename)
if video_path is None or not os.path.exists(video_path):
    raise HTTPException(status_code=404, detail=f"Video not found: {filename}")
```

**Frontend**:
- Browser displays native error message if video fails to load
- User can close modal and try again
- Future enhancement: Display custom error message in modal

## State Management

### Polling Mechanism

```typescript
useEffect(() => {
  void fetchIncidents()
  void fetchBreaches()
  
  const interval = setInterval(() => {
    void fetchIncidents()
    void fetchBreaches()
  }, 20000)  // 20 seconds
  
  return () => clearInterval(interval)
}, [fetchIncidents, fetchBreaches])
```

**Design decisions**:
- 20-second interval balances freshness with server load
- `useCallback` on fetch functions prevents unnecessary re-renders
- Cleanup function clears interval on unmount
- `void` operator explicitly ignores promise return values

### Filter State Management

```typescript
const [filter, setFilter] = useState<FilterType>("all")

const filtered = useMemo(() => 
  incidents.filter((i) => {
    if (filter === "all") return true
    if (filter === i.status) return true
    if (filter === i.sev) return true
    return false
  }), 
  [incidents, filter]
)
```

**Design decisions**:
- `useMemo` prevents re-filtering on every render
- Filter applies to both status and severity
- "All" filter shows all incidents

### Statistics Computation

```typescript
const cntOpen = useMemo(() => 
  incidents.filter((i) => i.status === "open").length, 
  [incidents]
)
const cntAck = useMemo(() => 
  incidents.filter((i) => i.status === "acknowledged").length, 
  [incidents]
)
const cntRes = useMemo(() => 
  incidents.filter((i) => i.status === "resolved").length, 
  [incidents]
)
const cntCrit = useMemo(() => 
  incidents.filter((i) => i.sev === "CRITICAL").length, 
  [incidents]
)
```

**Design decisions**:
- `useMemo` prevents re-computation on every render
- Statistics update automatically when incidents change
- Separate counts for each statistic card

### Breach-to-Incident Linking

```typescript
const incidentByBreachId = useMemo(
  () => new Map(rawIncidents.map((incident) => [incident.breach_id, incident])),
  [rawIncidents]
)
```

**Purpose**: Determine if a breach has an associated incident

**Usage**:
```typescript
const linkedIncident = incidentByBreachId.get(breach.id)
const isAcknowledged = linkedIncident?.status === "acknowledged"
```

**Design decisions**:
- Map provides O(1) lookup by breach ID
- `useMemo` prevents rebuilding map on every render
- Used to show "Acknowledged" state on breach cards

### Modal State Management

```typescript
// Resolve modal
const [resolveModalId, setResolveModalId] = useState<string | null>(null)
const [resolveNotes, setResolveNotes] = useState("")
const [resolving, setResolving] = useState(false)

// Video modal
const [selectedBreachVideo, setSelectedBreachVideo] = useState<{
  breachId: string
  videoFile: string
  breachType: string
} | null>(null)
```

**Design decisions**:
- `null` indicates modal is closed
- Non-null value indicates modal is open with specific data
- Separate loading states for async operations

### Error State Management

```typescript
const [acknowledging, setAcknowledging] = useState<string | null>(null)
const [ackError, setAckError] = useState<string | null>(null)
```

**Design decisions**:
- `acknowledging` tracks which incident/breach is being acknowledged (for loading state)
- `ackError` stores error message to display to user
- Error clears when user tries again


## API Integration

### Service Layer (`depotPerimeter.ts`)

The service layer provides a clean abstraction over HTTP requests:

```typescript
// Fetch all incidents (with optional filters)
export async function getIncidents(params?: {
  status?: string
  severity?: string
}): Promise<IncidentResponse[]> {
  const query = new URLSearchParams()
  if (params?.status) query.set("status", params.status)
  if (params?.severity) query.set("severity", params.severity)
  const q = query.toString() ? `?${query.toString()}` : ""
  const res = await api.get<IncidentResponse[]>(`/depot/vision/perimeter/incidents${q}`)
  return res.data
}

// Fetch active breaches
export async function getActiveBreaches(): Promise<BreachResponse[]> {
  const res = await api.get<BreachResponse[]>("/depot/vision/perimeter/breaches/active")
  return res.data
}

// Create incident from breach
export async function createIncidentFromBreach(breachId: string): Promise<IncidentResponse> {
  const res = await api.post<IncidentResponse>(`/depot/vision/perimeter/incidents/from-breach/${breachId}`)
  return res.data
}

// Acknowledge incident
export async function acknowledgeIncident(incidentId: string, reason: string): Promise<IncidentResponse> {
  const res = await api.patch<IncidentResponse>(`/depot/vision/perimeter/incidents/${incidentId}/acknowledge`, {
    reason,
  })
  return res.data
}

// Resolve incident
export async function resolveIncident(incidentId: string, resolutionNotes: string): Promise<IncidentResponse> {
  const res = await api.patch<IncidentResponse>(`/depot/vision/perimeter/incidents/${incidentId}/resolve`, {
    resolution_notes: resolutionNotes,
  })
  return res.data
}
```

### API Request/Response Examples

#### GET /depot/vision/perimeter/incidents

**Request**:
```http
GET /depot/vision/perimeter/incidents HTTP/1.1
Host: localhost:8000
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "breach_id": "660e8400-e29b-41d4-a716-446655440001",
    "zone_id": "770e8400-e29b-41d4-a716-446655440002",
    "severity": "critical",
    "title": "Security Incident — Cold Storage",
    "description": "Unauthorized entry detected in Cold Storage. Confidence: 92%.",
    "escalation_level": 0,
    "escalation_deadline": "2024-01-15T10:35:00Z",
    "escalated_to": "Security Supervisor",
    "status": "open",
    "acknowledged_at": null,
    "acknowledged_by": null,
    "resolved_at": null,
    "resolved_by": null,
    "resolution_notes": null,
    "video_archive_ref": "Perimeter_Detection.mp4",
    "created_at": "2024-01-15T10:30:00Z"
  }
]
```

#### PATCH /depot/vision/perimeter/incidents/{id}/acknowledge

**Request**:
```http
PATCH /depot/vision/perimeter/incidents/550e8400-e29b-41d4-a716-446655440000/acknowledge HTTP/1.1
Host: localhost:8000
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Acknowledged from incident console"
}
```

**Response** (200 OK):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "breach_id": "660e8400-e29b-41d4-a716-446655440001",
  "zone_id": "770e8400-e29b-41d4-a716-446655440002",
  "severity": "critical",
  "title": "Security Incident — Cold Storage",
  "description": "Unauthorized entry detected in Cold Storage. Confidence: 92%.",
  "escalation_level": 0,
  "escalation_deadline": "2024-01-15T10:35:00Z",
  "escalated_to": "Security Supervisor",
  "status": "acknowledged",
  "acknowledged_at": "2024-01-15T10:32:00Z",
  "acknowledged_by": "user@example.com",
  "resolved_at": null,
  "resolved_by": null,
  "resolution_notes": null,
  "video_archive_ref": "Perimeter_Detection.mp4",
  "created_at": "2024-01-15T10:30:00Z"
}
```

#### GET /depot/vision/cameras/video-library/{filename}/stream

**Request** (initial):
```http
GET /depot/vision/cameras/video-library/Perimeter_Detection.mp4/stream HTTP/1.1
Host: localhost:8000
```

**Response** (200 OK):
```http
HTTP/1.1 200 OK
Content-Type: video/mp4
Content-Length: 15728640
Accept-Ranges: bytes
Cache-Control: no-cache

<binary video data>
```

**Request** (with Range):
```http
GET /depot/vision/cameras/video-library/Perimeter_Detection.mp4/stream HTTP/1.1
Host: localhost:8000
Range: bytes=0-1023
```

**Response** (206 Partial Content):
```http
HTTP/1.1 206 Partial Content
Content-Type: video/mp4
Content-Range: bytes 0-1023/15728640
Content-Length: 1024
Accept-Ranges: bytes
Cache-Control: no-cache

<binary video data (first 1024 bytes)>
```

## Seed Data Integration

### Seed Data Structure

The seed script (`seed_intelliops.py`) generates 5 sample incidents:

```python
data["incidents"] = [
    {
        "title": "SLA Breach — Cold Chain Delivery",
        "description": "Temperature compliance SLA violated for ColdChain Inc shipment.",
        "priority": "P1",
        "source": "sla_breach",
        "zone": "Cold Storage"
    },
    {
        "title": "Unauthorized Vehicle at Inbound Gate",
        "description": "LPR mismatch. Vehicle not in approved list.",
        "source": "perimeter",
        "zone": "Inbound Gate"
    },
    {
        "title": "Dwell Time Alert — Truck TRK-1002",
        "description": "Vehicle in staging area for 4h 30m. SLA threshold: 3h.",
        "source": "alert",
        "zone": "Staging Area"
    },
    {
        "title": "Equipment Malfunction — Forklift FORK-03",
        "description": "Hydraulic pressure below threshold.",
        "priority": "P3",
        "source": "sensor",
        "zone": "Dispatch Bay"
    },
    {
        "title": "Fire alarm triggered in warehouse",
        "description": "Smoke detector activated in section B.",
        "source": "sensor",
        "zone": "Cold Storage"
    }
]
```

### Seed Data Mapping to Perimeter Incidents

To populate the `depot_perimeter_incidents` table, the seed script must:

1. **Create or reference perimeter zones** for each zone mentioned
2. **Create perimeter breaches** for incidents with source "perimeter"
3. **Create incidents** from breaches or directly for other sources
4. **Map priority to severity**:
   - P1 → critical
   - P2 → high
   - P3 → medium
   - (default) → low

5. **Map source to breach type** (for perimeter incidents):
   - perimeter → unauthorized_entry
   - alert → loitering
   - sensor → unknown
   - sla_breach → after_hours

6. **Assign video references** based on breach type using BREACH_VIDEO_MAP

### Seed Script Enhancement

The seed script should be enhanced to:

```python
async def seed_perimeter_incidents(db: AsyncSession):
    """Seed perimeter incidents for demo."""
    
    # Create zones if they don't exist
    zones = {}
    for zone_name in ["Cold Storage", "Inbound Gate", "Staging Area", "Dispatch Bay"]:
        zone = PerimeterZone(
            name=zone_name,
            zone_type="controlled",
            alert_on_entry=True,
            alert_severity="high"
        )
        db.add(zone)
        await db.flush()
        zones[zone_name] = zone
    
    # Create breaches and incidents
    incidents_data = [
        {
            "title": "SLA Breach — Cold Chain Delivery",
            "description": "Temperature compliance SLA violated for ColdChain Inc shipment.",
            "severity": "critical",
            "source": "sla_breach",
            "zone": "Cold Storage",
            "breach_type": "after_hours"
        },
        {
            "title": "Unauthorized Vehicle at Inbound Gate",
            "description": "LPR mismatch. Vehicle not in approved list.",
            "severity": "high",
            "source": "perimeter",
            "zone": "Inbound Gate",
            "breach_type": "unauthorized_entry"
        },
        {
            "title": "Dwell Time Alert — Truck TRK-1002",
            "description": "Vehicle in staging area for 4h 30m. SLA threshold: 3h.",
            "severity": "medium",
            "source": "alert",
            "zone": "Staging Area",
            "breach_type": "loitering"
        },
        {
            "title": "Equipment Malfunction — Forklift FORK-03",
            "description": "Hydraulic pressure below threshold.",
            "severity": "medium",
            "source": "sensor",
            "zone": "Dispatch Bay",
            "breach_type": "unknown"
        },
        {
            "title": "Fire alarm triggered in warehouse",
            "description": "Smoke detector activated in section B.",
            "severity": "critical",
            "source": "sensor",
            "zone": "Cold Storage",
            "breach_type": "unknown"
        }
    ]
    
    for inc_data in incidents_data:
        zone = zones[inc_data["zone"]]
        
        # Create breach
        breach = PerimeterBreach(
            zone_id=zone.id,
            breach_type=inc_data["breach_type"],
            severity=inc_data["severity"],
            confidence=0.85,
            detected_at=datetime.now(timezone.utc) - timedelta(hours=random.randint(1, 24)),
            alert_sent=True
        )
        db.add(breach)
        await db.flush()
        
        # Map breach type to video file
        video_map = {
            "unauthorized_entry": "Perimeter_Detection.mp4",
            "loitering": "Theft Camera .mp4",
            "after_hours": "Perimeter_Detection.mp4",
            "unknown": "LPR_RECOGNITION.mp4"
        }
        
        # Create incident
        incident = PerimeterIncident(
            breach_id=breach.id,
            zone_id=zone.id,
            severity=inc_data["severity"],
            title=inc_data["title"],
            description=inc_data["description"],
            escalation_level=0,
            escalation_deadline=datetime.now(timezone.utc) + timedelta(minutes=5),
            escalated_to="Security Supervisor",
            status="open",
            video_archive_ref=video_map[inc_data["breach_type"]]
        )
        db.add(incident)
    
    await db.commit()
```

## Error Handling

### Frontend Error Handling

#### API Request Errors

```typescript
const fetchIncidents = useCallback(async () => {
  try {
    const backendIncidents = await getIncidents()
    setRawIncidents(backendIncidents)
    setIncidents(backendIncidents.map(mapBackendIncident))
  } catch {
    // Keep empty — don't pad with stale mock data
    // User sees empty state message
  }
}, [])
```

**Design decision**: Silent failure keeps UI clean. Empty state message informs user.

#### Acknowledgement Errors

```typescript
const acknowledge = async (id: string) => {
  if (acknowledging !== null) return
  setAcknowledging(id)
  setAckError(null)
  try {
    await acknowledgeIncident(id, "Acknowledged from incident console")
    await fetchIncidents()
  } catch {
    setAckError("Unable to acknowledge this incident. The displayed data was not changed.")
  } finally {
    setAcknowledging(null)
  }
}
```

**Design decision**: Show error message to user, allow retry.

#### Resolution Errors

```typescript
const handleResolve = async () => {
  if (!resolveModalId || resolveNotes.length < 5 || resolving) return
  setResolving(true)
  try {
    await resolveIncident(resolveModalId, resolveNotes)
    void fetchIncidents()
    setResolveModalId(null)
    setResolveNotes("")
  } catch {
    // Keep modal open, allow retry
  } finally {
    setResolving(false)
  }
}
```

**Design decision**: Keep modal open on error, allow user to retry without re-entering notes.

### Backend Error Handling

#### Incident Not Found

```python
incident = await db.get(PerimeterIncident, incident_id)
if not incident:
    raise HTTPException(status_code=404, detail="Incident not found")
```

#### Breach Not Found

```python
breach = await db.get(PerimeterBreach, breach_id)
if not breach:
    raise HTTPException(status_code=404, detail="Breach not found")
```

#### Video File Not Found

```python
video_path = get_local_video_path(filename)
if video_path is None or not os.path.exists(video_path):
    raise HTTPException(status_code=404, detail=f"Video not found: {filename}")
```

#### Validation Errors

```python
class IncidentAcknowledge(BaseModel):
    reason: str = Field(..., min_length=5)

class IncidentResolve(BaseModel):
    resolution_notes: str = Field(..., min_length=5)
```

Pydantic automatically validates and returns 422 Unprocessable Entity for invalid input.

## Testing Strategy

### Unit Tests

**Frontend Unit Tests** (Jest + React Testing Library):

1. **Component Rendering**:
   - IncidentsPage renders with empty state
   - IncidentsPage renders with incidents
   - Incident card displays all metadata correctly
   - Breach card displays all metadata correctly

2. **Data Mapping**:
   - `mapBackendIncident()` correctly maps all fields
   - Severity mapping handles all values
   - Status mapping handles all values including "escalated"
   - Timestamp formatting is correct

3. **Filtering**:
   - "All" filter shows all incidents
   - Status filters show only matching incidents
   - Severity filters show only matching incidents

4. **Statistics**:
   - Counts are calculated correctly
   - Counts update when incidents change

5. **State Management**:
   - Modal opens and closes correctly
   - Error messages display correctly
   - Loading states work correctly

**Backend Unit Tests** (pytest):

1. **Incident CRUD**:
   - Create incident from breach
   - List incidents with filters
   - Acknowledge incident
   - Resolve incident

2. **Breach CRUD**:
   - List active breaches
   - Resolve breach

3. **Video Streaming**:
   - Stream video file returns 200
   - Stream video file with Range returns 206
   - Stream non-existent file returns 404
   - Accept-Ranges header is present

4. **Data Validation**:
   - Acknowledge requires reason (min 5 chars)
   - Resolve requires notes (min 5 chars)
   - Invalid UUIDs return 404

### Integration Tests

1. **End-to-End Incident Workflow**:
   - Create breach → Create incident → Acknowledge → Resolve
   - Verify status transitions
   - Verify timestamps are set correctly

2. **Breach-to-Incident Linking**:
   - Create incident from breach
   - Verify breach_id is set
   - Verify video_archive_ref is populated

3. **Polling Behavior**:
   - Verify incidents refresh every 20 seconds
   - Verify breaches refresh every 20 seconds
   - Verify no duplicate requests

4. **Video Streaming**:
   - Video player loads and plays
   - Seeking works correctly
   - Range requests are sent
   - 206 responses are received

### Manual Testing Checklist

- [ ] Incidents page loads with real data
- [ ] Statistics cards show correct counts
- [ ] Filters work correctly
- [ ] Incident cards display all metadata
- [ ] Breach cards display all metadata
- [ ] Acknowledge button works on incidents
- [ ] Acknowledge button works on breaches
- [ ] Resolve modal opens and closes
- [ ] Resolve button requires 5+ characters
- [ ] Resolve button updates incident status
- [ ] Analysis button opens video modal
- [ ] Video plays in modal
- [ ] Video seeking works
- [ ] Video modal closes on click outside
- [ ] Error messages display correctly
- [ ] Loading states display correctly
- [ ] Polling updates data every 20 seconds


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I identified the following properties suitable for property-based testing. I then performed reflection to eliminate redundancy:

**Redundancy Analysis**:

1. **Incident Metadata Display Properties (5.1-5.7)**: These can be combined into a single comprehensive property that verifies all metadata fields are displayed correctly for any incident.

2. **Statistics Count Properties (11.2-11.5)**: These are all testing the same counting logic with different filters. They can be combined into a single property that verifies counts are correct for any status/severity filter.

3. **Filter Properties (9.2-9.8)**: The specific filter tests (9.4-9.8) are redundant with the general filtering property (9.2). The general property subsumes all specific cases.

4. **Conditional Button Display Properties (6.1, 6.6, 7.1, 7.7, 8.1, 8.5)**: These can be combined into properties that verify button visibility rules for any incident/breach state.

**Retained Properties** (after eliminating redundancy):

### Property 1: Backend Incident Mapping Preserves All Fields

*For any* backend incident response (IncidentResponse), the mapping function `mapBackendIncident()` SHALL produce a valid UI incident (Incident) with all required fields correctly populated and formatted.

**Validates: Requirements 1.2**

### Property 2: Severity Mapping Correctness

*For any* backend severity value (critical, high, medium, low), the mapping function SHALL produce the correct UI severity (CRITICAL, HIGH, MEDIUM, LOW) with the correct color code.

**Validates: Requirements 1.5, 5.2**

### Property 3: Breach Type to Video File Mapping

*For any* breach type (unauthorized_entry, loitering, forced_entry, after_hours, object_left, unknown), the system SHALL return the correct video filename according to the BREACH_VIDEO_MAP.

**Validates: Requirements 2.4**

### Property 4: Video Archive Reference Display Format

*For any* incident with a non-null video_archive_ref, the UI SHALL display the camera reference in the format "📷 {video_archive_ref}".

**Validates: Requirements 2.2**

### Property 5: URL Encoding for Video Filenames

*For any* video filename containing special characters (spaces, punctuation, etc.), the system SHALL correctly percent-encode the filename using `encodeURIComponent` before constructing the video URL.

**Validates: Requirements 3.4**

### Property 6: Video URL Construction

*For any* video filename, the system SHALL construct the video URL in the format `/backend/depot/vision/cameras/video-library/{encoded_filename}/stream`.

**Validates: Requirements 4.1**

### Property 7: Incident Metadata Display Completeness

*For any* incident, the Incident_Card SHALL display all required metadata fields: title, severity badge with correct color, status badge with correct color, timestamp in format "MMM DD, HH:MM", location as "Zone ID: {zone_id}", assignee (or "—" if unassigned), and description.

**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7**

### Property 8: Acknowledge Button Visibility for Incidents

*For any* incident, the Incident_Card SHALL display an "Acknowledge" button if and only if the incident status is "open".

**Validates: Requirements 6.1, 6.6**

### Property 9: Resolve Button Visibility for Incidents

*For any* incident, the Incident_Card SHALL display a "Resolve" button if and only if the incident status is "open" or "acknowledged".

**Validates: Requirements 7.1, 7.7**

### Property 10: Resolution Notes Validation

*For any* input string, the resolution notes validation SHALL accept strings with 5 or more characters and reject strings with fewer than 5 characters.

**Validates: Requirements 7.3**

### Property 11: Acknowledge Button Visibility for Breaches

*For any* breach, the Breach_Card SHALL display an "Acknowledge" button if and only if the breach does not have a linked incident with status "acknowledged" or "resolved".

**Validates: Requirements 8.1, 8.5**

### Property 12: Incident Filtering Correctness

*For any* filter selection (status or severity) and any set of incidents, the filtered list SHALL contain only incidents that match the filter criteria, and SHALL contain all incidents that match the filter criteria.

**Validates: Requirements 9.2**

### Property 13: Active Filter Styling

*For any* filter button, when that filter is active, the button SHALL have the correct styling (orange border and background).

**Validates: Requirements 9.9**

### Property 14: Breach Metadata Display Completeness

*For any* breach, the Breach_Card SHALL display all required metadata: severity badge, breach type label, timestamp, camera reference (if available), zone ID, and notes (if available).

**Validates: Requirements 10.3**

### Property 15: Statistics Count Accuracy

*For any* set of incidents, the statistics counts SHALL accurately reflect the number of incidents matching each category: open status, acknowledged status, resolved status, and CRITICAL severity.

**Validates: Requirements 11.2, 11.3, 11.4, 11.5**

### Property-Based Testing Implementation Notes

**Testing Library**: Use `fast-check` for TypeScript/JavaScript property-based testing

**Test Configuration**: Each property test must run a minimum of 100 iterations

**Test Tagging**: Each property test must include a comment tag referencing the design property:
```typescript
// Feature: incidents-data-restoration, Property 1: Backend Incident Mapping Preserves All Fields
```

**Generator Strategy**:
- Create custom generators for `IncidentResponse`, `BreachResponse`, and `Incident` types
- Use `fc.record()` to generate objects with required fields
- Use `fc.constantFrom()` for enum values (severity, status, breach_type)
- Use `fc.uuid()` for UUID fields
- Use `fc.date()` for timestamp fields
- Use `fc.string()` with constraints for text fields

**Example Property Test**:
```typescript
import fc from 'fast-check'

// Feature: incidents-data-restoration, Property 1: Backend Incident Mapping Preserves All Fields
test('mapBackendIncident preserves all fields', () => {
  fc.assert(
    fc.property(
      fc.record({
        id: fc.uuid(),
        breach_id: fc.uuid(),
        zone_id: fc.uuid(),
        severity: fc.constantFrom('critical', 'high', 'medium', 'low'),
        title: fc.string({ minLength: 1 }),
        description: fc.option(fc.string()),
        escalation_level: fc.nat(),
        escalation_deadline: fc.option(fc.date().map(d => d.toISOString())),
        escalated_to: fc.option(fc.string()),
        status: fc.constantFrom('open', 'acknowledged', 'escalated', 'resolved'),
        acknowledged_at: fc.option(fc.date().map(d => d.toISOString())),
        acknowledged_by: fc.option(fc.string()),
        resolved_at: fc.option(fc.date().map(d => d.toISOString())),
        resolved_by: fc.option(fc.string()),
        resolution_notes: fc.option(fc.string()),
        video_archive_ref: fc.option(fc.string()),
        created_at: fc.date().map(d => d.toISOString()),
      }),
      (backendIncident) => {
        const uiIncident = mapBackendIncident(backendIncident)
        
        // Verify all fields are present
        expect(uiIncident.id).toBe(backendIncident.id)
        expect(uiIncident.type).toBe(backendIncident.title)
        expect(uiIncident.sev).toBeDefined()
        expect(uiIncident.loc).toContain(backendIncident.zone_id)
        expect(uiIncident.t).toBeDefined()
        expect(uiIncident.status).toBeDefined()
        expect(uiIncident.cam).toBeDefined()
        expect(uiIncident.desc).toBeDefined()
        expect(uiIncident.assignee).toBeDefined()
      }
    ),
    { numRuns: 100 }
  )
})
```


## Deployment Considerations

### Environment Configuration

**Backend Environment Variables**:
```env
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/intellidepo

# Video Library Path
VIDEO_LIBRARY_PATH=/path/to/video/library

# CORS (for frontend development)
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

**Frontend Environment Variables**:
```env
# API Base URL
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Video Library Setup

**Required Video Files**:
1. `Perimeter_Detection.mp4` - Used for unauthorized_entry, forced_entry, after_hours breaches
2. `Theft Camera .mp4` - Used for loitering, object_left breaches (note: filename contains space)
3. `LPR_RECOGNITION.mp4` - Used for unknown breach types

**Video Library Directory Structure**:
```
/path/to/video/library/
├── Perimeter_Detection.mp4
├── Theft Camera .mp4
└── LPR_RECOGNITION.mp4
```

**Video File Requirements**:
- Format: MP4 (H.264 video codec, AAC audio codec)
- Resolution: 1920x1080 or lower (for performance)
- File size: < 50MB per file (for reasonable streaming performance)
- Duration: 30-60 seconds (sufficient for incident analysis)

### Database Migrations

**Required Tables**:
1. `depot_perimeter_zones` - Perimeter zone definitions
2. `depot_perimeter_breaches` - Breach event records
3. `depot_perimeter_incidents` - Incident records

**Migration Script**:
```bash
# Run Alembic migrations
cd backend
alembic upgrade head
```

**Seed Data**:
```bash
# Run seed script to populate sample data
cd backend
python seed_intelliops.py
```

### Performance Considerations

**Frontend Optimizations**:
1. **Memoization**: Use `useMemo` for expensive computations (filtering, statistics)
2. **Callback Stability**: Use `useCallback` for fetch functions to prevent unnecessary re-renders
3. **Polling Interval**: 20-second interval balances freshness with server load
4. **Lazy Loading**: Video modal only loads video when opened

**Backend Optimizations**:
1. **Database Indexing**: Indexes on `zone_id`, `breach_id`, `camera_id` for fast queries
2. **Query Filtering**: Support filtering at database level (status, severity)
3. **File Streaming**: Use `FileResponse` for efficient file streaming (chunks, not full load)
4. **Connection Pooling**: Use SQLAlchemy async connection pool

**Video Streaming Optimizations**:
1. **HTTP Range Requests**: Enable seeking without downloading entire file
2. **Chunk Size**: FastAPI automatically uses optimal chunk size (64KB)
3. **Cache Control**: `no-cache` prevents stale video caching
4. **Accept-Ranges**: Advertise range support to browser

### Security Considerations

**Authentication**:
- All API endpoints require authentication (JWT token)
- Frontend includes token in Authorization header
- Backend validates token on every request

**Authorization**:
- RBAC permissions check for incident management actions
- Only authorized users can acknowledge/resolve incidents
- Video access requires authentication

**Input Validation**:
- Pydantic models validate all API inputs
- Frontend validates resolution notes (min 5 characters)
- URL encoding prevents injection attacks

**Video Access Control**:
- Video files are served through authenticated endpoint
- Direct file system access is not exposed
- File path traversal is prevented by `get_local_video_path()` validation

### Monitoring and Logging

**Backend Logging**:
```python
logger.info(f"Incident acknowledged: {incident.id} by {user.email}")
logger.warning(f"BREACH [{breach.severity.upper()}] zone={zone.name}")
logger.error(f"Video file not found: {filename}")
```

**Frontend Error Tracking**:
- Log API errors to console (development)
- Send errors to monitoring service (production)
- Display user-friendly error messages

**Metrics to Monitor**:
1. **API Response Times**: Track latency for incident/breach endpoints
2. **Polling Frequency**: Monitor actual polling rate vs. expected 20s
3. **Video Streaming**: Track video load times and buffering events
4. **Error Rates**: Monitor API error rates (4xx, 5xx)
5. **Database Query Performance**: Track slow queries

### Scalability Considerations

**Current Scale**:
- Expected: 10-100 concurrent users
- Incidents: 100-1000 active incidents
- Breaches: 10-100 active breaches
- Video files: 3 files, ~50MB total

**Scaling Strategies** (if needed):
1. **Database**: Add read replicas for query scaling
2. **Video Streaming**: Use CDN for video delivery
3. **Polling**: Implement WebSocket for real-time updates (eliminate polling)
4. **Caching**: Add Redis cache for frequently accessed data
5. **Load Balancing**: Add multiple backend instances behind load balancer

### Browser Compatibility

**Supported Browsers**:
- Chrome 90+ (full support)
- Firefox 88+ (full support)
- Safari 14+ (full support)
- Edge 90+ (full support)

**Required Features**:
- HTML5 video element
- HTTP Range request support
- ES2020 JavaScript features
- CSS Grid and Flexbox

**Fallbacks**:
- Video player shows error message if browser doesn't support MP4
- Polling falls back to manual refresh if browser doesn't support setInterval (unlikely)

### Troubleshooting Guide

**Issue: Incidents not loading**
- Check backend API is running: `curl http://localhost:8000/health`
- Check database connection: Review backend logs
- Check authentication: Verify JWT token is valid
- Check CORS: Verify frontend origin is allowed

**Issue: Video not playing**
- Check video file exists: `ls /path/to/video/library/`
- Check video file permissions: `chmod 644 /path/to/video/library/*.mp4`
- Check video URL encoding: Verify spaces are encoded as `%20`
- Check browser console for errors
- Check Accept-Ranges header: `curl -I http://localhost:8000/depot/vision/cameras/video-library/Perimeter_Detection.mp4/stream`

**Issue: Polling not working**
- Check browser console for errors
- Verify setInterval is running: Add console.log in fetch functions
- Check network tab for API calls every 20 seconds
- Verify component is mounted (not unmounted)

**Issue: Acknowledge/Resolve not working**
- Check API response in network tab
- Verify user has permissions (RBAC)
- Check backend logs for errors
- Verify incident ID is valid UUID

## Summary

The Incidents Data Restoration feature integrates the existing IncidentsPage UI with backend APIs to display real incident and breach data. The system provides:

1. **Real-time Monitoring**: 20-second polling keeps data fresh
2. **Video Evidence**: HTTP Range-enabled streaming for smooth playback
3. **Incident Workflows**: Acknowledge and resolve incidents with proper state transitions
4. **Breach Escalation**: Create incidents from breaches and acknowledge them
5. **Filtering and Statistics**: Filter by status/severity and view summary statistics
6. **Seed Data**: Populate database with realistic sample data

The design emphasizes:
- **Clean Architecture**: Separation of concerns (UI, service layer, backend)
- **Type Safety**: TypeScript interfaces for all data models
- **Performance**: Memoization, efficient polling, streaming video
- **User Experience**: Loading states, error messages, responsive UI
- **Testability**: Property-based testing for core logic, unit tests for components

The implementation leverages existing infrastructure (FastAPI, React, PostgreSQL) and requires minimal new code—primarily integration and data mapping logic.

