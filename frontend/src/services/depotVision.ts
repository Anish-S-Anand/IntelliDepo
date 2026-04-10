/**
 * Depot Vision API Service
 *
 * Handles detection runs, colour analysis, and mismatch alerts.
 * Integrates with DEPOT-V2 (detection) and DEPOT-V2.1 (colour analysis) backend APIs.
 */
import api from "./api";

// ---------------------------------------------------------------------------
// Detection Types
// ---------------------------------------------------------------------------

export interface DetectionModel {
  id: string;
  model_name: string;
  model_version: string;
  confidence_threshold: number;
  iou_threshold: number;
  target_classes: string;
  is_active: boolean;
  description: string | null;
  created_at: string;
}

export interface DetectionRunResponse {
  id: string;
  camera_id: string | null;
  model_id: string;
  status: string;
  frame_count: number;
  total_detections: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  initiated_by: string | null;
  created_at: string;
}

export interface DetectedObject {
  id: string;
  run_id: string;
  frame_number: number;
  class_label: string;
  confidence: number;
  bbox_x: number;
  bbox_y: number;
  bbox_w: number;
  bbox_h: number;
  size_estimate_cm2: number | null;
  count_in_frame: number;
  created_at: string;
}

export interface RunSummary {
  run: DetectionRunResponse;
  detections_by_class: Record<string, number>;
  average_confidence: number;
}

// ---------------------------------------------------------------------------
// Colour Analysis Types
// ---------------------------------------------------------------------------

export interface ColourResult {
  id: string;
  analysis_run_id: string;
  detected_object_id: string;
  class_label: string;
  colour_category: string;
  rgb_r: number;
  rgb_g: number;
  rgb_b: number;
  hsv_h: number;
  hsv_s: number;
  hsv_v: number;
  confidence: number;
  bbox_x: number | null;
  bbox_y: number | null;
  bbox_w: number | null;
  bbox_h: number | null;
  frame_number: number | null;
  created_at: string;
}

export interface ColourAnalysisRunResponse {
  id: string;
  detection_run_id: string;
  camera_id: string | null;
  status: string;
  total_analysed: number;
  started_at: string | null;
  completed_at: string | null;
  initiated_by: string | null;
  created_at: string;
}

export interface ColourMismatchAlert {
  id: string;
  analysis_run_id: string;
  manifest_code: string | null;
  expected_colour: string | null;
  detected_colours: string | null;
  mismatch_count: number;
  total_analysed: number;
  severity: string;
  message: string | null;
  acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Mismatch Alert Types (Counting)
// ---------------------------------------------------------------------------

export interface MismatchAlert {
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
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Combined Alert (for UI panel)
// ---------------------------------------------------------------------------

export type AlertType = "count_mismatch" | "colour_mismatch";

export interface UnifiedAlert {
  id: string;
  type: AlertType;
  severity: string;
  message: string;
  manifest_code: string | null;
  acknowledged: boolean;
  created_at: string;
  raw: MismatchAlert | ColourMismatchAlert;
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

export async function getDetectionModels(): Promise<DetectionModel[]> {
  const res = await api.get<DetectionModel[]>("/depot/vision/detection/models");
  return res.data;
}

export async function startDetectionRun(
  modelId: string,
  frameCount: number,
  cameraId?: string,
): Promise<DetectionRunResponse> {
  const res = await api.post<DetectionRunResponse>("/depot/vision/detection/runs", {
    model_id: modelId,
    frame_count: frameCount,
    camera_id: cameraId ?? null,
  });
  return res.data;
}

export async function getDetectionRuns(cameraId?: string): Promise<DetectionRunResponse[]> {
  const params = cameraId ? `?camera_id=${cameraId}` : "";
  const res = await api.get<DetectionRunResponse[]>(`/depot/vision/detection/runs${params}`);
  return res.data;
}

export async function getRunSummary(runId: string): Promise<RunSummary> {
  const res = await api.get<RunSummary>(`/depot/vision/detection/runs/${runId}`);
  return res.data;
}

export async function getRunObjects(runId: string, classLabel?: string): Promise<DetectedObject[]> {
  const params = classLabel ? `?class_label=${classLabel}` : "";
  const res = await api.get<DetectedObject[]>(`/depot/vision/detection/runs/${runId}/objects${params}`);
  return res.data;
}

export async function getMismatchAlerts(acknowledged?: boolean): Promise<MismatchAlert[]> {
  const params = acknowledged !== undefined ? `?acknowledged=${acknowledged}` : "";
  const res = await api.get<MismatchAlert[]>(`/depot/vision/counting/alerts${params}`);
  return res.data;
}

export async function getActiveMismatchAlerts(): Promise<MismatchAlert[]> {
  const res = await api.get<MismatchAlert[]>("/depot/vision/counting/alerts/active");
  return res.data;
}

export async function acknowledgeMismatchAlert(alertId: string): Promise<MismatchAlert> {
  const res = await api.patch<MismatchAlert>(`/depot/vision/counting/alerts/${alertId}/acknowledge`);
  return res.data;
}

export async function getActiveColourAlerts(): Promise<ColourMismatchAlert[]> {
  const res = await api.get<ColourMismatchAlert[]>("/depot/vision/colour/alerts/active");
  return res.data;
}

export async function acknowledgeColourAlert(alertId: string): Promise<ColourMismatchAlert> {
  const res = await api.patch<ColourMismatchAlert>(`/depot/vision/colour/alerts/${alertId}/acknowledge`);
  return res.data;
}

/**
 * Fetch all active alerts (count mismatches + colour mismatches) unified.
 */
export async function getAllActiveAlerts(): Promise<UnifiedAlert[]> {
  try {
    const [countAlerts, colourAlerts] = await Promise.allSettled([
      getActiveMismatchAlerts(),
      getActiveColourAlerts(),
    ]);

    const unified: UnifiedAlert[] = [];

    if (countAlerts.status === "fulfilled") {
      for (const alert of countAlerts.value) {
        unified.push({
          id: alert.id,
          type: "count_mismatch",
          severity: alert.severity,
          message: alert.message ?? `Count mismatch: expected ${alert.expected_total}, found ${alert.counted_total}`,
          manifest_code: alert.manifest_code,
          acknowledged: alert.acknowledged,
          created_at: alert.created_at,
          raw: alert,
        });
      }
    }

    if (colourAlerts.status === "fulfilled") {
      for (const alert of colourAlerts.value) {
        unified.push({
          id: alert.id,
          type: "colour_mismatch",
          severity: alert.severity,
          message: alert.message ?? `Colour mismatch on ${alert.manifest_code}`,
          manifest_code: alert.manifest_code,
          acknowledged: alert.acknowledged,
          created_at: alert.created_at,
          raw: alert,
        });
      }
    }

    // Sort by created_at descending
    unified.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return unified;
  } catch {
    return [];
  }
}
