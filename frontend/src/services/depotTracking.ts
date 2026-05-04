/**
 * Depot Tracking API Service
 *
 * Handles DeepSORT multi-object tracking sessions and tracked objects.
 * Integrates with DEPOT-V3.1 backend API.
 */
import api from "./api";

export interface TrackedObject {
  id: string;
  track_id: number;
  session_id: string;
  camera_id: string | null;
  class_label: string;
  first_seen_frame: number;
  last_seen_frame: number;
  total_frames: number;
  avg_confidence: number;
  last_bbox_x: number;
  last_bbox_y: number;
  last_bbox_w: number;
  last_bbox_h: number;
  direction: string;
  speed_estimate: number | null;
  is_counted: boolean;
  crossed_line: boolean;
  created_at: string;
}

export interface TrackingSession {
  id: string;
  camera_id: string | null;
  detection_run_id: string;
  status: string;
  total_frames: number;
  unique_objects: number;
  counts_by_class: Record<string, number> | null;
  started_at: string | null;
  completed_at: string | null;
  initiated_by: string | null;
  created_at: string;
}

export interface TrackingSummary {
  session: TrackingSession;
  tracked_objects: TrackedObject[];
  inbound_count: number;
  outbound_count: number;
}

export async function startTrackingRun(
  detectionRunId: string,
  countingLineY?: number,
): Promise<TrackingSummary> {
  const res = await api.post<TrackingSummary>("/depot/vision/tracking/run", {
    detection_run_id: detectionRunId,
    counting_line_y: countingLineY ?? 0.5,
  });
  return res.data;
}

export async function getTrackingSessions(cameraId?: string): Promise<TrackingSession[]> {
  const params = cameraId ? `?camera_id=${cameraId}` : "";
  const res = await api.get<TrackingSession[]>(`/depot/vision/tracking/sessions${params}`);
  return res.data;
}

export async function getTrackingSession(sessionId: string): Promise<TrackingSummary> {
  const res = await api.get<TrackingSummary>(`/depot/vision/tracking/sessions/${sessionId}`);
  return res.data;
}

export async function getTrackedObjects(
  sessionId: string,
  classLabel?: string,
): Promise<TrackedObject[]> {
  const params = classLabel ? `?class_label=${classLabel}` : "";
  const res = await api.get<TrackedObject[]>(
    `/depot/vision/tracking/sessions/${sessionId}/objects${params}`,
  );
  return res.data;
}
