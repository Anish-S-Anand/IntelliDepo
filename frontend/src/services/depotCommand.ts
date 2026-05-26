import api from "./api";

export interface CameraRecord {
  id: string;
  name: string;
  stream_url: string;
  protocol: string;
  zone: string | null;
  status: string;
  is_active: boolean;
  last_seen: string | null;
  frame_rate: number;
  resolution: string;
  created_at: string;
}

export interface ActiveStreamSummary {
  camera_id: string;
  stream_url: string;
  connected_at: string;
  frames_captured: number;
}

export interface ActiveStreamsResponse {
  active_count: number;
  streams: ActiveStreamSummary[];
}

export interface CameraFrame {
  camera_id: string;
  timestamp: string;
  frame_number: number;
  width: number;
  height: number;
  format: string;
}

export interface BreachRecord {
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
}

export interface GateRecord {
  id: string;
  gate_code: string;
  name: string;
  gate_type: string;
  camera_id: string | null;
  status: string;
  total_entries_today: number;
}

export interface AccessLogRecord {
  id: string;
  gate_id: string;
  gate_code: string | null;
  plate_number: string;
  plate_confidence: number;
  decision: string;
  direction: string;
  denied_reason: string | null;
  processed_at: string;
}

export interface LowStockRecord {
  id: string;
  sku_id: string;
  zone: string;
  rack: string | null;
  bin_location: string | null;
  quantity: number;
  reserved_quantity: number;
  reorder_level: number;
  max_capacity: number | null;
  status: string;
}

export interface ObservabilityResponse {
  status: string;
  timestamp: string;
  database?: { status?: string };
  metrics?: {
    total_requests?: number;
    total_errors?: number;
    error_rate?: number;
    avg_latency_ms?: number;
  };
}

export type IntegrationState = "live" | "auth" | "offline";

export interface IntegrationPanel<T> {
  state: IntegrationState;
  data: T;
  message?: string;
}

export interface DepotCommandSnapshot {
  generatedAt: string;
  cameras: IntegrationPanel<CameraRecord[]>;
  activeStreams: IntegrationPanel<ActiveStreamsResponse>;
  breaches: IntegrationPanel<BreachRecord[]>;
  gates: IntegrationPanel<GateRecord[]>;
  accessLogs: IntegrationPanel<AccessLogRecord[]>;
  lowStock: IntegrationPanel<LowStockRecord[]>;
  observability: IntegrationPanel<ObservabilityResponse | null>;
}

export interface CommandKpi {
  key: string;
  label: string;
  value: string;
  detail: string;
  tone: "healthy" | "warning" | "critical" | "normal";
}

export interface CommandException {
  id: string;
  source: string;
  title: string;
  detail: string;
  priority: string;
  zone: string | null;
  created_at: string | null;
}

export interface CommandZoneSummary {
  zone_code: string;
  name: string;
  utilization_pct: number;
  current_occupancy: number;
  max_capacity_units: number;
  status: string;
}

export interface CommandGateSummary {
  id: string;
  gate_code: string;
  name: string;
  gate_type: string;
  status: string;
  total_entries_today: number;
  last_activity_at: string | null;
}

export interface CommandCameraSummary {
  id: string;
  name: string;
  zone: string | null;
  status: string;
  protocol: string;
  last_seen: string | null;
}

export interface CommandTimelineItem {
  id: string;
  type: string;
  title: string;
  detail: string;
  status: string;
  occurred_at: string;
}

export interface CommandCenterSnapshot {
  generated_at: string;
  health_score: number;
  kpis: CommandKpi[];
  gates: CommandGateSummary[];
  cameras: CommandCameraSummary[];
  zones: CommandZoneSummary[];
  exceptions: CommandException[];
  timeline: CommandTimelineItem[];
  recent_actions: CommandActionResponse[];
}

function demoCommandCenterSnapshot(): CommandCenterSnapshot {
  const now = new Date().toISOString();
  return {
    generated_at: now,
    health_score: 82,
    kpis: [
      { key: "cameras", label: "Active Cameras", value: "6/6", detail: "Live visual coverage", tone: "healthy" },
      { key: "gates", label: "Open Gates", value: "1", detail: "42 entries today", tone: "warning" },
      { key: "incidents", label: "Open Incidents", value: "3", detail: "1 high priority", tone: "warning" },
      { key: "zones", label: "Capacity Risk", value: "2", detail: "Zones above 80% utilization", tone: "warning" },
    ],
    gates: [
      { id: "gate-a", gate_code: "GATE-A", name: "North Entry", gate_type: "entry", status: "open", total_entries_today: 18, last_activity_at: now },
      { id: "gate-b", gate_code: "GATE-B", name: "South Exit", gate_type: "exit", status: "closed", total_entries_today: 16, last_activity_at: now },
      { id: "gate-c", gate_code: "GATE-C", name: "Loading Bay", gate_type: "both", status: "closed", total_entries_today: 8, last_activity_at: now },
    ],
    cameras: [
      { id: "cam-1", name: "Inbound Gate Camera", zone: "Gate A", status: "active", protocol: "rtsp", last_seen: now },
      { id: "cam-2", name: "Loading Bay Camera", zone: "Dock 2", status: "active", protocol: "rtsp", last_seen: now },
      { id: "cam-3", name: "Zone A Storage Camera", zone: "Zone A", status: "active", protocol: "http", last_seen: now },
      { id: "cam-4", name: "Zone B Storage Camera", zone: "Zone B", status: "active", protocol: "http", last_seen: now },
      { id: "cam-5", name: "Perimeter Camera", zone: "Perimeter", status: "active", protocol: "rtsp", last_seen: now },
      { id: "cam-6", name: "Yard Overview Camera", zone: "Yard", status: "active", protocol: "rtsp", last_seen: now },
    ],
    zones: [
      { zone_code: "A", name: "UltraTech Cement - Zone A", utilization_pct: 92, current_occupancy: 920, max_capacity_units: 1000, status: "warning" },
      { zone_code: "B", name: "ACC Cement - Zone B", utilization_pct: 84, current_occupancy: 840, max_capacity_units: 1000, status: "warning" },
      { zone_code: "C", name: "JSW Cement - Zone C", utilization_pct: 61, current_occupancy: 610, max_capacity_units: 1000, status: "normal" },
      { zone_code: "D", name: "Ambuja Cement - Zone D", utilization_pct: 48, current_occupancy: 480, max_capacity_units: 1000, status: "normal" },
    ],
    exceptions: [
      { id: "ex-1", source: "Incident", title: "Unauthorized vehicle at inbound gate", detail: "LPR mismatch detected at Gate A", priority: "P1", zone: "Gate A", created_at: now },
      { id: "ex-2", source: "Inventory", title: "SKU cement-bag-43 below reorder level", detail: "38 available, reorder at 75", priority: "P2", zone: "Zone B", created_at: now },
      { id: "ex-3", source: "Perimeter", title: "Restricted zone motion detected", detail: "Camera flagged movement near perimeter", priority: "P2", zone: "Perimeter", created_at: now },
      { id: "ex-4", source: "Capacity", title: "Zone A nearing capacity", detail: "920 / 1000 bags occupied", priority: "P3", zone: "Zone A", created_at: now },
    ],
    timeline: [
      { id: "tl-1", type: "gate", title: "KA03NP0051 entry", detail: "GATE-A - granted", status: "granted", occurred_at: now },
      { id: "tl-2", type: "incident", title: "Unauthorized vehicle at inbound gate", detail: "High - open", status: "open", occurred_at: now },
      { id: "tl-3", type: "command", title: "Broadcast", detail: "Shift supervisor notified", status: "completed", occurred_at: now },
    ],
    recent_actions: [],
  };
}

type ApiOutcome<T> =
  | { kind: "success"; data: T }
  | { kind: "auth" }
  | { kind: "offline"; message: string };

async function safeGet<T>(url: string): Promise<ApiOutcome<T>> {
  try {
    const response = await api.get<T>(url);
    return { kind: "success", data: response.data };
  } catch (error: unknown) {
    const status = typeof error === "object" && error !== null && "response" in error
      ? (error as { response?: { status?: number } }).response?.status
      : undefined;

    if (status === 401 || status === 403) {
      return { kind: "auth" };
    }

    return { kind: "offline", message: status ? `HTTP ${status}` : "Unavailable" };
  }
}

function toPanel<T>(outcome: ApiOutcome<T>, fallback: T): IntegrationPanel<T> {
  if (outcome.kind === "success") {
    return { state: "live", data: outcome.data };
  }
  if (outcome.kind === "auth") {
    return { state: "auth", data: fallback, message: "Authentication required" };
  }
  return { state: "offline", data: fallback, message: outcome.message };
}

export async function getDepotCommandSnapshot(): Promise<DepotCommandSnapshot> {
  const [cameras, activeStreams, breaches, gates, accessLogs, lowStock, observability] = await Promise.all([
    safeGet<CameraRecord[]>("/depot/vision/cameras/"),
    safeGet<ActiveStreamsResponse>("/depot/vision/cameras/streams/active"),
    safeGet<BreachRecord[]>("/depot/vision/perimeter/breaches/active"),
    safeGet<GateRecord[]>("/depot/gate/gates"),
    safeGet<AccessLogRecord[]>("/depot/gate/access-logs?limit=8"),
    safeGet<LowStockRecord[]>("/depot/inventory/reports/low-stock"),
    safeGet<ObservabilityResponse>("/health/observability"),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    cameras: toPanel(cameras, []),
    activeStreams: toPanel(activeStreams, { active_count: 0, streams: [] }),
    breaches: toPanel(breaches, []),
    gates: toPanel(gates, []),
    accessLogs: toPanel(accessLogs, []),
    lowStock: toPanel(lowStock, []),
    observability: toPanel(observability, null),
  };
}

export async function getCommandCenterSnapshot(): Promise<CommandCenterSnapshot> {
  try {
    const res = await api.get<CommandCenterSnapshot>("/depot/command/snapshot", { timeout: 5000 });
    return {
      ...res.data,
      kpis: res.data.kpis.filter((kpi) => kpi.key !== "inventory" && kpi.key !== "access"),
    };
  } catch {
    return demoCommandCenterSnapshot();
  }
}

export interface CameraRegisterPayload {
  name: string;
  stream_url: string;
  protocol?: "rtsp" | "http" | "https";
  zone?: string;
  frame_rate?: number;
  resolution?: string;
}

export async function registerCamera(payload: CameraRegisterPayload): Promise<CameraRecord> {
  const res = await api.post<CameraRecord>("/depot/vision/cameras/register", payload);
  return res.data;
}

export async function deleteCamera(cameraId: string): Promise<void> {
  await api.delete(`/depot/vision/cameras/${cameraId}`);
}

export async function reconnectCamera(cameraId: string) {
  const response = await api.post<{ camera_id: string; status: string }>(`/depot/vision/cameras/${cameraId}/connect`);
  return response.data;
}

export async function getCameraFrame(cameraId: string): Promise<IntegrationPanel<CameraFrame | null>> {
  const outcome = await safeGet<CameraFrame>(`/depot/vision/cameras/${cameraId}/frame`);
  return toPanel(outcome, null);
}

/**
 * Get the MJPEG stream URL for a camera (for use in <img> src).
 * Points directly to the backend port to bypass Next.js proxy buffering.
 * seek: offset in seconds so cameras sharing the same video show different parts.
 */
export function getCameraMjpegUrl(cameraId: string, theme: "dark" | "light" = "dark", seek = 0): string {
  const base = typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000");
  const seekParam = seek > 0 ? `&seek=${seek}` : "";
  return `${base}/depot/vision/cameras/${cameraId}/mjpeg?theme=${theme}${seekParam}`;
}

/**
 * Get the snapshot URL for a camera (for use in <img> src).
 * seek: offset in seconds so cameras sharing the same video show different parts.
 */
export function getCameraSnapshotUrl(cameraId: string, theme: "dark" | "light" = "light", seek = 0): string {
  const base = typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000");
  const seekParam = seek > 0 ? `&seek=${seek}` : "";
  return `${base}/depot/vision/cameras/${cameraId}/snapshot?theme=${theme}${seekParam}`;
}

/**
 * Get the RTSP proxy MJPEG stream URL for any RTSP/HTTP source.
 */
export function getRtspProxyUrl(rtspUrl: string): string {
  const base = typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000");
  return `${base}/depot/vision/cameras/rtsp-proxy/stream?url=${encodeURIComponent(rtspUrl)}`;
}

// ---------------------------------------------------------------------------
// Quick Action types & functions
// ---------------------------------------------------------------------------

export interface CommandActionResponse {
  id: string;
  action_type: string;
  status: string;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  zone: string | null;
  message: string;
}

export type CommandActionErrorKind = "auth" | "offline" | "server";

export class CommandActionError extends Error {
  kind: CommandActionErrorKind;
  status?: number;
  constructor(kind: CommandActionErrorKind, message: string, status?: number) {
    super(message);
    this.name = "CommandActionError";
    this.kind = kind;
    this.status = status;
  }
}

function getHttpStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "response" in error) {
    return (error as { response?: { status?: number } }).response?.status;
  }
  return undefined;
}

function toCommandActionError(error: unknown): CommandActionError {
  const status = getHttpStatus(error);
  if (status === 401 || status === 403)
    return new CommandActionError("auth", "Please sign in to run Command Center actions.", status);
  if (status)
    return new CommandActionError("server", `Command action failed (HTTP ${status}).`, status);
  return new CommandActionError("offline", "Command action service is unavailable.");
}

function isDemoSession(): boolean {
  return typeof window !== "undefined" && localStorage.getItem("token")?.startsWith("demo-token-") === true;
}

const DEMO_GATES = [
  { id: "gate-a", name: "Gate A — North Entry" },
  { id: "gate-b", name: "Gate B — South Exit" },
  { id: "gate-c", name: "Gate C — Loading Bay" },
];

function demoCommandAction(url: string, payload: Record<string, unknown>): CommandActionResponse {
  const actionType = url.split("/").pop()?.replaceAll("-", "_") || "command_action";
  const gateId = typeof payload.gate_id === "string" ? payload.gate_id : undefined;
  const gate = gateId ? DEMO_GATES.find((g) => g.id === gateId) : undefined;
  const zone = typeof payload.zone === "string" ? payload.zone : null;
  const messages: Record<string, string> = {
    open_gate: `${gate?.name || "Selected gate"} opened in demo mode`,
    close_gate: `${gate?.name || "Selected gate"} closed in demo mode`,
    lock_zone: `Zone ${zone || "perimeter"} locked in demo mode`,
    trigger_alert: "Manual alert triggered in demo mode",
    contact_operator: "Operator paged in demo mode",
  };
  return {
    id: `demo-${Date.now()}`,
    action_type: actionType,
    status: "success",
    target_type: gate ? "gate" : zone ? "zone" : null,
    target_id: gate?.id ?? null,
    target_name: gate?.name ?? null,
    zone,
    message: messages[actionType] ?? "Action completed in demo mode",
  };
}

async function postCommandAction(url: string, payload: Record<string, unknown>): Promise<CommandActionResponse> {
  try {
    const res = await api.post<CommandActionResponse>(url, payload);
    return res.data;
  } catch (error) {
    const status = getHttpStatus(error);
    if (
      isDemoSession()
      || status === 404
      || status === 502
      || status === 503
      || status === 504
      || status === undefined
    ) {
      return demoCommandAction(url, payload);
    }
    throw toCommandActionError(error);
  }
}

export async function openCommandGate(gateId?: string): Promise<CommandActionResponse> {
  return postCommandAction("/depot/command/actions/open-gate", { gate_id: gateId });
}

export async function closeCommandGate(gateId?: string): Promise<CommandActionResponse> {
  return postCommandAction("/depot/command/actions/close-gate", { gate_id: gateId });
}

export async function lockCommandZone(zone = "Depot perimeter"): Promise<CommandActionResponse> {
  return postCommandAction("/depot/command/actions/lock-zone", {
    zone,
    reason: "Manual lockdown from Command Center quick action",
  });
}

export async function triggerCommandAlert(params?: {
  title?: string;
  message?: string;
  priority?: string;
}): Promise<CommandActionResponse> {
  return postCommandAction("/depot/command/actions/trigger-alert", {
    title: params?.title ?? "Manual Command Center alert",
    message: params?.message ?? "All operators notified from Command Center quick action",
    priority: params?.priority ?? "P2",
  });
}

export async function contactCommandOperator(params?: {
  operator?: string;
  channel?: string;
  message?: string;
}): Promise<CommandActionResponse> {
  return postCommandAction("/depot/command/actions/contact-operator", {
    operator: params?.operator ?? "Shift Supervisor",
    channel: params?.channel ?? "in_app",
    message: params?.message ?? "Please contact Command Center",
  });
}
