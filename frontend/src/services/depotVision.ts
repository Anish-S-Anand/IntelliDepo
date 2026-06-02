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

export interface DetectFrameParams {
  file: File;
  modelId: string;
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
// Analysis Section Types
// ---------------------------------------------------------------------------

export interface CameraWithDetections {
  id: string;
  name: string;
  cameraId: string;
  detectionCount: number;
  lastDetectionAt: string | null;
  videoFile?: string;
}

export interface LPRDetection {
  id: string;
  plateNumber: string;
  confidence: number;
  timestamp: string;
  cameraId: string;
  cameraName: string;
  videoRef: string | null;
  snapshotRef: string | null;
  decision: "granted" | "denied" | "pending" | "blacklisted";
  deniedReason?: string;
}

// Custom error classes for better error handling
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

export class ServerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServerError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class APIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "APIError";
  }
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

export async function getDetectionModels(): Promise<DetectionModel[]> {
  const res = await api.get<DetectionModel[]>("/depot/vision/detection/models");
  return res.data;
}

let lastCall = 0;

export async function startDetectionRun(
  modelId: string,
  frameCount: number,
  cameraId?: string,
): Promise<DetectionRunResponse> {

  const now = Date.now();

  // ✅ enforce spacing between API calls
  if (now - lastCall < 500) {
    await new Promise((res) => setTimeout(res, 500));
  }

  lastCall = Date.now();

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

export async function detectUploadedFrame({
  file,
  modelId,
}: DetectFrameParams): Promise<DetectedObject[]> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("model_id", modelId);

  const res = await api.post<DetectedObject[]>("/depot/vision/detection/detect-frame", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
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

// ---------------------------------------------------------------------------
// Analysis Section API Functions
// ---------------------------------------------------------------------------

/**
 * Helper to get backend base URL
 */
function getBackendBase(): string {
  // Use the Next.js proxy to avoid CORS issues
  if (typeof window !== "undefined") {
    return "/backend";
  }
  return "http://localhost:8000";
}

/**
 * Construct video URL with proper encoding for filenames with spaces
 */
export function getVideoUrl(filename: string): string {
  const backendBase = getBackendBase();
  // Use the /stream endpoint for regular video playback (not MJPEG)
  return `${backendBase}/depot/vision/cameras/video-library/${encodeURIComponent(filename)}/stream`;
}

/**
 * Fetch cameras with detection counts
 * Note: This uses the gates endpoint and access logs to build camera detection data.
 */
export async function getCamerasWithDetections(): Promise<CameraWithDetections[]> {
  try {
    // Fetch gates and access logs directly using the api service
    const [gatesRes, logsRes] = await Promise.all([
      api.get<any[]>("/depot/gate/gates"),
      api.get<any[]>("/depot/gate/access-logs?limit=1000")
    ]);
    
    const gates = gatesRes.data;
    const accessLogs = logsRes.data;
    
    // Group access logs by gate_id to count detections
    const detectionCounts: Record<string, { count: number; lastDetection: string | null }> = {};
    
    for (const log of accessLogs) {
      if (!detectionCounts[log.gate_id]) {
        detectionCounts[log.gate_id] = { count: 0, lastDetection: null };
      }
      detectionCounts[log.gate_id].count++;
      
      // Track most recent detection
      if (!detectionCounts[log.gate_id].lastDetection || 
          new Date(log.processed_at) > new Date(detectionCounts[log.gate_id].lastDetection!)) {
        detectionCounts[log.gate_id].lastDetection = log.processed_at;
      }
    }
    
    // Map gates to CameraWithDetections format with different videos for each
    const videoFiles = [
      "LPR_RECOGNITION.mp4",
      "Perimeter_Detection.mp4", 
      "cluster 4-5 (1).mp4",
      "cluster 13 (1).mp4",
      "Theft Camera .mp4",
      "dtranshipment 1 (2).mp4"
    ];
    
    const cameras: CameraWithDetections[] = gates
      .filter(gate => gate.camera_id) // Only gates with cameras
      .map((gate, index) => ({
        id: gate.id,
        name: gate.name,
        cameraId: gate.camera_id!,
        detectionCount: detectionCounts[gate.id]?.count || 0,
        lastDetectionAt: detectionCounts[gate.id]?.lastDetection || null,
        videoFile: videoFiles[index % videoFiles.length], // Assign different videos
      }));
    
    return cameras;
  } catch (error: any) {
    console.error("Error fetching cameras with detections:", error);
    
    // If authentication error or network error, return mock data for demo
    if (error?.response?.status === 401 || error instanceof TypeError) {
      console.warn("Using mock camera data due to authentication/network error");
      
      // Return mock cameras with the same structure
      const mockCameras: CameraWithDetections[] = [
        {
          id: "gate-entry-north",
          name: "Gate Entry North - LPR",
          cameraId: "cam-001",
          detectionCount: 45,
          lastDetectionAt: new Date(Date.now() - 300000).toISOString(),
          videoFile: "LPR_RECOGNITION.mp4",
        },
        {
          id: "zone-a-overhead",
          name: "Zone A Overhead",
          cameraId: "cam-002",
          detectionCount: 32,
          lastDetectionAt: new Date(Date.now() - 600000).toISOString(),
          videoFile: "Perimeter_Detection.mp4",
        },
        {
          id: "loading-bay-1-4",
          name: "Loading Bay 1-4",
          cameraId: "cam-003",
          detectionCount: 28,
          lastDetectionAt: new Date(Date.now() - 900000).toISOString(),
          videoFile: "cluster 4-5 (1).mp4",
        },
        {
          id: "zone-c-perimeter",
          name: "Zone C Perimeter",
          cameraId: "cam-004",
          detectionCount: 19,
          lastDetectionAt: new Date(Date.now() - 1200000).toISOString(),
          videoFile: "cluster 13 (1).mp4",
        },
        {
          id: "gate-exit-south",
          name: "Gate Exit South",
          cameraId: "cam-005",
          detectionCount: 38,
          lastDetectionAt: new Date(Date.now() - 180000).toISOString(),
          videoFile: "Theft Camera .mp4",
        },
        {
          id: "yard-overview",
          name: "Yard Overview",
          cameraId: "cam-006",
          detectionCount: 52,
          lastDetectionAt: new Date(Date.now() - 120000).toISOString(),
          videoFile: "dtranshipment 1 (2).mp4",
        },
      ];
      
      return mockCameras;
    }
    
    throw new APIError("Failed to fetch cameras with detections");
  }
}

/**
 * Fetch LPR detections for a specific camera (gate)
 */
export async function getDetectionsForCamera(cameraId: string): Promise<LPRDetection[]> {
  try {
    // Fetch gates and access logs directly using the api service
    const gatesRes = await api.get<any[]>("/depot/gate/gates");
    const gates = gatesRes.data;
    
    // Find the gate associated with this camera
    const gate = gates.find(g => g.camera_id === cameraId || g.id === cameraId);
    
    if (!gate) {
      throw new NotFoundError(`Camera ${cameraId} not found`);
    }
    
    // Fetch access logs for this gate
    const logsRes = await api.get<any[]>(`/depot/gate/access-logs?gate_id=${gate.id}&limit=100`);
    const accessLogs = logsRes.data;
    
    // Transform access logs to LPRDetection format
    const detections: LPRDetection[] = accessLogs.map(log => ({
      id: log.id,
      plateNumber: log.plate_number,
      confidence: log.plate_confidence,
      timestamp: log.processed_at,
      cameraId: gate.camera_id || gate.id,
      cameraName: gate.name,
      videoRef: null, // Will be populated when video archive is implemented
      snapshotRef: null, // Will be populated when snapshot storage is implemented
      decision: log.decision as "granted" | "denied" | "pending" | "blacklisted",
      deniedReason: log.denied_reason || undefined,
    }));
    
    return detections;
  } catch (error: any) {
    console.error("Error fetching detections for camera:", error);
    
    // If authentication error, return mock detections
    if (error?.response?.status === 401) {
      console.warn("Using mock detection data due to authentication error");
      
      // Generate mock LPR detections
      const mockDetections: LPRDetection[] = [];
      const states = ["MH", "DL", "KA", "TN", "GJ"];
      const decisions: Array<"granted" | "denied" | "pending"> = ["granted", "granted", "granted", "denied", "pending"];
      
      for (let i = 0; i < 15; i++) {
        const state = states[i % states.length];
        const num1 = String(Math.floor(Math.random() * 99) + 1).padStart(2, "0");
        const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        const letter1 = letters[Math.floor(Math.random() * letters.length)];
        const letter2 = letters[Math.floor(Math.random() * letters.length)];
        const num2 = String(Math.floor(Math.random() * 9999) + 1).padStart(4, "0");
        const plateNumber = `${state} ${num1} ${letter1}${letter2} ${num2}`;
        
        const decision = decisions[i % decisions.length];
        
        mockDetections.push({
          id: `mock-${i}`,
          plateNumber,
          confidence: 0.85 + Math.random() * 0.14,
          timestamp: new Date(Date.now() - i * 300000).toISOString(),
          cameraId,
          cameraName: "Mock Camera",
          videoRef: null,
          snapshotRef: null,
          decision,
          deniedReason: decision === "denied" ? "Vehicle not in whitelist" : undefined,
        });
      }
      
      return mockDetections;
    }
    
    if (error instanceof NotFoundError) {
      throw error;
    }
    if (error instanceof TypeError) {
      throw new NetworkError("Network connection failed");
    }
    throw new APIError("Failed to fetch detections for camera");
  }
}

/**
 * Fetch with error handling and retry logic
 */
export async function fetchWithRetry<T>(
  url: string,
  options?: RequestInit,
  maxRetries = 3
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new NotFoundError("Resource not found");
        } else if (response.status >= 500) {
          throw new ServerError("Server error occurred");
        } else {
          throw new APIError(`Request failed: ${response.statusText}`);
        }
      }
      
      return await response.json();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on client errors (4xx)
      if (error instanceof NotFoundError || error instanceof APIError) {
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
  }
  
  throw lastError!;
}