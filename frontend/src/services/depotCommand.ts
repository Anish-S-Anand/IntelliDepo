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
 */
export function getCameraMjpegUrl(cameraId: string, theme: "dark" | "light" = "dark"): string {
  // MJPEG streams must bypass the Next.js proxy (which buffers responses).
  // Use the direct backend URL in the browser.
  const base = typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000");
  return `${base}/depot/vision/cameras/${cameraId}/mjpeg?theme=${theme}`;
}

/**
 * Get the snapshot URL for a camera (for use in <img> src).
 */
export function getCameraSnapshotUrl(cameraId: string, theme: "dark" | "light" = "light"): string {
  const base = typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000");
  return `${base}/depot/vision/cameras/${cameraId}/snapshot?theme=${theme}`;
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
