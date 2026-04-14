/**
 * IntelliOps™ — Operations API Service
 *
 * Centralized API calls for all IntelliOps modules (F-054 to F-073).
 * Uses the shared axios instance with proper auth and proxy routing.
 */
import api from "./api";

// ---------------------------------------------------------------------------
// Live Monitoring (F-054 – F-058)
// ---------------------------------------------------------------------------

export interface DashboardKPIData {
  total_events_today: number;
  active_alerts: number;
  critical_alerts: number;
  high_alerts: number;
  medium_alerts: number;
  acknowledged_count: number;
  avg_response_time_min: number;
  events_per_hour: number;
}

export interface OpsAlert {
  id: string;
  alert_type: string;
  severity: string;
  priority_score: number;
  source_name?: string;
  zone?: string;
  title: string;
  message?: string;
  status: string;
  acknowledged_by?: string;
  timestamp: string;
}

export interface OpsEvent {
  id: string;
  event_type: string;
  source_id: string;
  source_name?: string;
  zone?: string;
  severity: string;
  value?: number;
  unit?: string;
  message?: string;
  timestamp: string;
}

export async function getDashboardKPIs(): Promise<DashboardKPIData> {
  const { data } = await api.get("/ops/monitoring/dashboard/kpis");
  return data;
}

export async function getActiveAlerts(): Promise<OpsAlert[]> {
  const { data } = await api.get("/ops/monitoring/alerts/active");
  return data;
}

export async function getEvents(limit = 20): Promise<OpsEvent[]> {
  const { data } = await api.get(`/ops/monitoring/events?limit=${limit}`);
  return data;
}

export async function acknowledgeAlert(alertId: string): Promise<OpsAlert> {
  const { data } = await api.patch(`/ops/monitoring/alerts/${alertId}/acknowledge`);
  return data;
}

export async function escalateAlert(alertId: string): Promise<OpsAlert> {
  const { data } = await api.patch(`/ops/monitoring/alerts/${alertId}/escalate`);
  return data;
}

// ---------------------------------------------------------------------------
// SLA Tracking (F-059 – F-063)
// ---------------------------------------------------------------------------

export interface SLADefinition {
  id: string;
  name: string;
  threshold_value: number;
  threshold_unit?: string;
  [key: string]: unknown;
}

export interface BreachPrediction {
  breach_probability: number;
  escalation_status: string;
  predicted_breach_at?: string;
  time_to_breach_minutes?: number;
  current_value: number;
  threshold_value: number;
  [key: string]: unknown;
}

export interface ScorecardSummary {
  overall_compliance_pct: number;
  total_slas: number;
  total_compliant: number;
  total_at_risk: number;
  total_breached: number;
  total_penalty: number;
  currency: string;
  by_group: Record<string, unknown>[];
}

export async function getSLAs(): Promise<SLADefinition[]> {
  const { data } = await api.get("/sla");
  return data;
}

export async function getBreachPrediction(slaId: string): Promise<BreachPrediction> {
  const { data } = await api.get(`/sla/${slaId}/breach-prediction`);
  return data;
}

export async function getAtRiskSLAs(): Promise<BreachPrediction[]> {
  const { data } = await api.get("/sla/breach-predictions/at-risk");
  return data;
}

export async function getScorecardSummary(groupType = "module"): Promise<ScorecardSummary> {
  const { data } = await api.get(`/ops/scorecards/summary?group_type=${groupType}`);
  return data;
}

// ---------------------------------------------------------------------------
// Fleet & Yard (F-064 – F-068)
// ---------------------------------------------------------------------------

export interface VehicleResponse {
  vehicle_id: string;
  vehicle_type: string;
  driver_name: string | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
  speed_kmh: number;
  current_zone: string | null;
  assigned_dock: string | null;
  entered_yard_at: string | null;
  [key: string]: unknown;
}

export interface DockSlotResponse {
  dock_id: string;
  dock_name: string | null;
  zone: string | null;
  status: string;
  assigned_vehicle_id: string | null;
  dock_type: string;
  x_position: number;
  y_position: number;
  [key: string]: unknown;
}

export interface QueueOptResult {
  recommendations: {
    vehicle_id: string;
    vehicle_type: string | null;
    wait_minutes: number;
    recommended_dock: string;
    dock_type: string;
    priority_score: number;
    reason: string;
  }[];
  total_vehicles_waiting: number;
  avg_wait_minutes: number;
}

export interface DwellHeatmapEntry {
  zone: string;
  avg_dwell_minutes: number;
  total_vehicles: number;
  over_threshold_count: number;
}

export interface DockScheduleResponse {
  id: string;
  dock_id: string;
  vehicle_id: string | null;
  client_name: string | null;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
  delay_risk: boolean;
  notes: string | null;
  [key: string]: unknown;
}

export async function getVehicles(limit = 100): Promise<VehicleResponse[]> {
  const { data } = await api.get(`/ops/fleet/vehicles?limit=${limit}`);
  return data;
}

export async function getDocks(): Promise<DockSlotResponse[]> {
  const { data } = await api.get("/ops/fleet/docks");
  return data;
}

export async function getQueueOptimization(): Promise<QueueOptResult> {
  const { data } = await api.get("/ops/fleet/queue/optimize");
  return data;
}

export async function getDwellHeatmap(): Promise<DwellHeatmapEntry[]> {
  const { data } = await api.get("/ops/fleet/dwell/heatmap");
  return data;
}

export async function getDockSchedules(weekOffset = 0): Promise<DockScheduleResponse[]> {
  const { data } = await api.get(`/ops/fleet/schedules?week_offset=${weekOffset}`);
  return data;
}

export async function createDockSchedule(payload: {
  dock_id: string;
  vehicle_id?: string | null;
  client_name?: string | null;
  scheduled_start: string;
  scheduled_end: string;
}): Promise<DockScheduleResponse> {
  const { data } = await api.post("/ops/fleet/schedules", payload);
  return data;
}

// ---------------------------------------------------------------------------
// Incident Escalation (F-069 – F-073)
// ---------------------------------------------------------------------------

export interface IncidentResponse {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  severity_score: number;
  status: string;
  source: string;
  zone: string | null;
  assigned_to: string | null;
  escalation_level: number;
  escalation_chain: { tier: string; assigned_at: string }[];
  escalation_deadline: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  resolution_steps: string[];
  created_at: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  actor: string | null;
  actor_role: string | null;
  previous_state: string | null;
  new_state: string | null;
  details: string | null;
  created_at: string;
}

export interface NotificationEntry {
  id: string;
  channel: string;
  recipient: string | null;
  status: string;
  sent_at: string;
}

export async function getActiveIncidents(): Promise<IncidentResponse[]> {
  const { data } = await api.get("/ops/incidents/active");
  return data;
}

export async function getIncidentAudit(incidentId: string): Promise<AuditEntry[]> {
  const { data } = await api.get(`/ops/incidents/${incidentId}/audit`);
  return data;
}

export async function getIncidentNotifications(incidentId: string): Promise<NotificationEntry[]> {
  const { data } = await api.get(`/ops/incidents/${incidentId}/notifications`);
  return data;
}
