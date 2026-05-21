import api from "./api";

// Types matching backend schemas

export interface ManifestResponse {
  id: string;
  manifest_code: string;
  shipment_ref: string | null;
  expected_bags: number;
  expected_boxes: number;
  expected_pallets: number;
  expected_cartons: number;
  total_expected: number;
  gate_id: string | null;
  vehicle_number: string | null;
  status: string;
  verified_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface CountSessionResponse {
  id: string;
  manifest_id: string | null;
  detection_run_id: string | null;
  camera_id: string | null;
  zone: string | null;
  counted_bags: number;
  counted_boxes: number;
  counted_pallets: number;
  counted_cartons: number;
  total_counted: number;
  confidence_avg: number;
  reconciliation_status: string;
  discrepancy_bags: number;
  discrepancy_boxes: number;
  discrepancy_total: number;
  alert_sent: boolean;
  counted_by: string | null;
  created_at: string;
}

export interface MismatchAlertResponse {
  id: string;
  session_id: string;
  manifest_id: string | null;
  manifest_code: string | null;
  expected_total: number;
  counted_total: number;
  discrepancy: number;
  severity: string;
  message: string | null;
  acknowledged: boolean;
  created_at: string;
}

export interface ReconciliationResult {
  session: CountSessionResponse;
  manifest: ManifestResponse | null;
  alert: MismatchAlertResponse | null;
  status: string;
}

export interface ReconciliationReport {
  total_sessions: number;
  total_expected: number;
  total_counted: number;
  total_discrepancy: number;
  matched_sessions: number;
  mismatch_sessions: number;
  pending_sessions: number;
  match_rate_pct: number;
  discrepancy_by_type: Record<string, number>;
  active_alerts: number;
}

export interface RealtimeDetection {
  track_id: number;
  class: string;
  role?: string;
  role_confidence?: number;
  countable?: boolean;
  source_model?: string;
  raw_class?: string;
  confidence: number;
  bbox_x: number;
  bbox_y: number;
  bbox_w: number;
  bbox_h: number;
}

export interface RealtimeCameraCount {
  camera_id: string;
  name?: string;
  zone?: string;
  video_file?: string;
  reference_video?: string;
  scene?: string;
  in_count: number;
  out_count: number;
  loaded_count?: number;
  unloaded_count?: number;
  total: number;
  by_class: Record<string, number | { in?: number; out?: number; net?: number }>;
  detections?: RealtimeDetection[];
  last_update?: string;
}

export interface RealtimeCountsResponse {
  today: {
    in?: number;
    out?: number;
    net?: number;
    total?: number;
    [key: string]: number | undefined;
  };
  cameras: Record<string, RealtimeCameraCount>;
  counting_line_y: number;
  running: boolean;
  timestamp: string;
}

// API functions

export async function getManifests(): Promise<ManifestResponse[]> {
  const res = await api.get<ManifestResponse[]>("/depot/vision/counting/manifests");
  return res.data;
}

export async function getCountSessions(manifestId?: string): Promise<CountSessionResponse[]> {
  const params = manifestId ? `?manifest_id=${manifestId}` : "";
  const res = await api.get<CountSessionResponse[]>(`/depot/vision/counting/sessions${params}`);
  return res.data;
}

export async function getReconciliationReport(): Promise<ReconciliationReport> {
  const res = await api.get<ReconciliationReport>("/depot/vision/counting/reconciliation/report");
  return res.data;
}

export async function getRealtimeCounts(): Promise<RealtimeCountsResponse> {
  const res = await api.get<RealtimeCountsResponse>("/depot/vision/realtime/counts");
  return res.data;
}

export async function getMismatchAlerts(acknowledged?: boolean): Promise<MismatchAlertResponse[]> {
  const params = acknowledged !== undefined ? `?acknowledged=${acknowledged}` : "";
  const res = await api.get<MismatchAlertResponse[]>(`/depot/vision/counting/alerts${params}`);
  return res.data;
}
