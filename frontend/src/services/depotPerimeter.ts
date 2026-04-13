/**
 * Depot Perimeter API Service
 *
 * Handles perimeter zones, breach events, incidents, and night vision config.
 * Integrates with DEPOT-V7 (perimeter monitoring) backend APIs.
 */
import api from "./api";

// ---------------------------------------------------------------------------
// Zone Types
// ---------------------------------------------------------------------------

export interface PerimeterZoneResponse {
  id: string;
  name: string;
  description: string | null;
  zone_type: string;
  camera_id: string | null;
  polygon_points: string | null;
  alert_on_entry: boolean;
  alert_severity: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Breach Types
// ---------------------------------------------------------------------------

export interface BreachResponse {
  id: string;
  zone_id: string;
  camera_id: string | null;
  breach_type: string;
  severity: string;
  confidence: number | null;
  snapshot_ref: string | null;
  alert_sent: boolean;
  notes: string | null;
  detected_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Incident Types
// ---------------------------------------------------------------------------

export interface IncidentResponse {
  id: string;
  breach_id: string;
  zone_id: string;
  severity: string;
  title: string;
  description: string | null;
  escalation_level: number;
  escalation_deadline: string | null;
  escalated_to: string | null;
  status: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  video_archive_ref: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Agent Result
// ---------------------------------------------------------------------------

export interface BreachAgentResult {
  zones_scanned: number;
  breaches_detected: number;
  alerts_dispatched: number;
  breaches: BreachResponse[];
}

// ---------------------------------------------------------------------------
// Zone API
// ---------------------------------------------------------------------------

export async function getPerimeterZones(zoneType?: string, cameraId?: string): Promise<PerimeterZoneResponse[]> {
  const params = new URLSearchParams();
  if (zoneType) params.set("zone_type", zoneType);
  if (cameraId) params.set("camera_id", cameraId);
  const q = params.toString() ? `?${params.toString()}` : "";
  const res = await api.get<PerimeterZoneResponse[]>(`/depot/vision/perimeter/zones${q}`);
  return res.data;
}

export async function getPerimeterZone(zoneId: string): Promise<PerimeterZoneResponse> {
  const res = await api.get<PerimeterZoneResponse>(`/depot/vision/perimeter/zones/${zoneId}`);
  return res.data;
}

export async function createPerimeterZone(data: {
  name: string;
  description?: string;
  zone_type?: string;
  camera_id?: string;
  polygon_points?: string;
  alert_on_entry?: boolean;
  alert_severity?: string;
}): Promise<PerimeterZoneResponse> {
  const res = await api.post<PerimeterZoneResponse>("/depot/vision/perimeter/zones", data);
  return res.data;
}

export async function deactivatePerimeterZone(zoneId: string): Promise<PerimeterZoneResponse> {
  const res = await api.patch<PerimeterZoneResponse>(`/depot/vision/perimeter/zones/${zoneId}/deactivate`);
  return res.data;
}

export async function configureNightVision(zoneId: string, data: {
  night_vision_enabled: boolean;
  night_vision_mode: string;
  active_hours_start?: string;
  active_hours_end?: string;
}): Promise<PerimeterZoneResponse> {
  const res = await api.patch<PerimeterZoneResponse>(`/depot/vision/perimeter/zones/${zoneId}/night-vision`, data);
  return res.data;
}

// ---------------------------------------------------------------------------
// Breach API
// ---------------------------------------------------------------------------

export async function getBreaches(params?: {
  zone_id?: string;
  resolved?: boolean;
}): Promise<BreachResponse[]> {
  const query = new URLSearchParams();
  if (params?.zone_id) query.set("zone_id", params.zone_id);
  if (params?.resolved !== undefined) query.set("resolved", String(params.resolved));
  const q = query.toString() ? `?${query.toString()}` : "";
  const res = await api.get<BreachResponse[]>(`/depot/vision/perimeter/breaches${q}`);
  return res.data;
}

export async function getActiveBreaches(): Promise<BreachResponse[]> {
  const res = await api.get<BreachResponse[]>("/depot/vision/perimeter/breaches/active");
  return res.data;
}

export async function resolveBreach(breachId: string, resolutionNotes?: string): Promise<BreachResponse> {
  const res = await api.patch<BreachResponse>(`/depot/vision/perimeter/breaches/${breachId}/resolve`, {
    resolution_notes: resolutionNotes,
  });
  return res.data;
}

export async function simulateBreach(data: {
  zone_id: string;
  breach_type?: string;
  confidence?: number;
  notes?: string;
}): Promise<BreachResponse> {
  const res = await api.post<BreachResponse>("/depot/vision/perimeter/breaches/simulate", data);
  return res.data;
}

// ---------------------------------------------------------------------------
// Incident API
// ---------------------------------------------------------------------------

export async function getIncidents(params?: {
  status?: string;
  severity?: string;
}): Promise<IncidentResponse[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.severity) query.set("severity", params.severity);
  const q = query.toString() ? `?${query.toString()}` : "";
  const res = await api.get<IncidentResponse[]>(`/depot/vision/perimeter/incidents${q}`);
  return res.data;
}

export async function getActiveIncidents(): Promise<IncidentResponse[]> {
  const res = await api.get<IncidentResponse[]>("/depot/vision/perimeter/incidents/active");
  return res.data;
}

export async function createIncidentFromBreach(breachId: string): Promise<IncidentResponse> {
  const res = await api.post<IncidentResponse>(`/depot/vision/perimeter/incidents/from-breach/${breachId}`);
  return res.data;
}

export async function acknowledgeIncident(incidentId: string, reason: string): Promise<IncidentResponse> {
  const res = await api.patch<IncidentResponse>(`/depot/vision/perimeter/incidents/${incidentId}/acknowledge`, {
    reason,
  });
  return res.data;
}

export async function resolveIncident(incidentId: string, resolutionNotes: string): Promise<IncidentResponse> {
  const res = await api.patch<IncidentResponse>(`/depot/vision/perimeter/incidents/${incidentId}/resolve`, {
    resolution_notes: resolutionNotes,
  });
  return res.data;
}

export async function escalateOverdueIncidents(): Promise<IncidentResponse[]> {
  const res = await api.post<IncidentResponse[]>("/depot/vision/perimeter/incidents/escalate-overdue");
  return res.data;
}

// ---------------------------------------------------------------------------
// Security Breach Agent
// ---------------------------------------------------------------------------

export async function runSecurityAgent(data?: {
  camera_id?: string;
  simulate_breach_count?: number;
}): Promise<BreachAgentResult> {
  const res = await api.post<BreachAgentResult>("/depot/vision/perimeter/agent/scan", data ?? {});
  return res.data;
}

// ---------------------------------------------------------------------------
// Unified alert count (for sidebar badge)
// ---------------------------------------------------------------------------

export async function getPerimeterAlertCount(): Promise<number> {
  try {
    const [breaches, incidents] = await Promise.allSettled([
      getActiveBreaches(),
      getActiveIncidents(),
    ]);
    let count = 0;
    if (breaches.status === "fulfilled") count += breaches.value.length;
    if (incidents.status === "fulfilled") count += incidents.value.length;
    return count;
  } catch {
    return 0;
  }
}
