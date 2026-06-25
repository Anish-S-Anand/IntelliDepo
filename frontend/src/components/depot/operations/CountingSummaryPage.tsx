"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  getCountSessions,
  getManifests,
  getRealtimeCounts,
  getReconciliationReport,
  type CountSessionResponse,
  type ManifestResponse,
  type RealtimeCountsResponse,
  type ReconciliationReport,
} from "@/services/depotCounting";
import {
  ScanLine,
} from "lucide-react";

// Lazy load the video component to improve initial page load
const LazyVideoFeed = dynamic(() => import("./LazyVideoFeed"), {
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-[#0F1A30]">
      <div className="text-[#8A9BBF] text-[12px]">Loading video player...</div>
    </div>
  ),
  ssr: false,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function reconciliationColor(status: string): string {
  if (status === "mismatch") return "#F04A4A";
  if (status === "pending") return "#F5A623";
  return "#22D3A1";
}

const STATUS_LABEL: Record<string, string> = { matched: "MATCHED", mismatch: "MISMATCH", pending: "PENDING" };

// ---------------------------------------------------------------------------
// Derived view-model types
// ---------------------------------------------------------------------------

interface SessionRow {
  id: string;
  manifestCode: string;
  vehicleNumber: string;
  expectedBags: number;
  expectedBoxes: number;
  countedBags: number;
  countedBoxes: number;
  totalExpected: number;
  totalCounted: number;
  discrepancy: number;
  confidenceAvg: number;
  status: string;
  zone: string;
  camera: string;
  timestamp: string;
}

interface BatchTally {
  id: string;
  batchCode: string;
  product: string;
  expected: number;
  counted: number;
  variance: number;
  variancePct: number;
  status: string;
}

interface TimeSeriesPoint {
  time: string;
  bags: number;
  boxes: number;
  cumulative: number;
}

const COUNTING_VIDEO_FILE = "bags_counting.mp4";

// Point directly to the backend port — bypasses Next.js proxy buffering which
// causes MJPEG streams to play in slow-motion.
function getCountingFeedUrl(): string {
  if (typeof window === "undefined") return "";
  const base = `${window.location.protocol}//${window.location.hostname}:8000`;
  return `${base}/depot/vision/cameras/video-library/${encodeURIComponent(COUNTING_VIDEO_FILE)}/mjpeg?theme=dark&fps=24`;
}

function classCount(camera: { by_class: RealtimeCountsResponse["cameras"][string]["by_class"] }, label: string): number {
  const value = camera.by_class[label];
  if (typeof value === "number") return value;
  return value?.net ?? ((value?.in ?? 0) - (value?.out ?? 0));
}

function activeClassCount(camera: RealtimeCountsResponse["cameras"][string] | undefined, label: string): number {
  const detections = camera?.detections ?? [];
  if (detections.length === 0) return classCount(camera ?? { by_class: {} }, label);
  return detections.filter((det) => det.class.toLowerCase() === label).length;
}

function activeConfidence(camera: RealtimeCountsResponse["cameras"][string] | undefined, fallback: string): string {
  const detections = camera?.detections ?? [];
  const bags = detections.filter((det) => det.class.toLowerCase() === "bag");
  const confidenceSource = bags.length > 0 ? bags : detections;
  if (confidenceSource.length === 0) return fallback;
  const avg = confidenceSource.reduce((sum, det) => sum + det.confidence, 0) / confidenceSource.length;
  return (avg * 100).toFixed(1);
}

function activeRoleCount(camera: RealtimeCountsResponse["cameras"][string] | undefined, role: string): number {
  return (camera?.detections ?? []).filter((det) => det.role?.toLowerCase() === role).length;
}

function detectionColor(detClass: string, role?: string): string {
  const label = role?.toLowerCase() ?? detClass.toLowerCase();
  if (label === "worker") return "#F5C542";
  if (label === "manager") return "#5B9BF5";
  if (detClass.toLowerCase() === "vehicle") return "#F5A623";
  if (detClass.toLowerCase() === "person") return "#A78BFA";
  return "#22D3A1";
}

function detectionLabel(detClass: string, role?: string): string {
  if (role === "worker") return "WORKER";
  if (role === "manager") return "MANAGER";
  return detClass.toUpperCase();
}


// ---------------------------------------------------------------------------
// Data-shaping helpers
// ---------------------------------------------------------------------------

function buildSessionRows(
  sessions: CountSessionResponse[],
  manifests: ManifestResponse[],
): SessionRow[] {
  const manifestMap = new Map<string, ManifestResponse>();
  for (const m of manifests) manifestMap.set(m.id, m);

  return sessions.map((s) => {
    const m = s.manifest_id ? manifestMap.get(s.manifest_id) : undefined;
    return {
      id: s.id,
      manifestCode: m?.manifest_code ?? "—",
      vehicleNumber: m?.vehicle_number ?? "—",
      expectedBags: m?.expected_bags ?? 0,
      expectedBoxes: m?.expected_boxes ?? 0,
      countedBags: s.counted_bags,
      countedBoxes: s.counted_boxes,
      totalExpected: m?.total_expected ?? 0,
      totalCounted: s.total_counted,
      discrepancy: s.discrepancy_total,
      confidenceAvg: s.confidence_avg,
      status: s.reconciliation_status,
      zone: s.zone ?? "—",
      camera: s.camera_id ?? "—",
      timestamp: new Date(s.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase(),
    };
  });
}

function buildBatchTallies(
  sessions: CountSessionResponse[],
  manifests: ManifestResponse[],
): BatchTally[] {
  const manifestMap = new Map<string, ManifestResponse>();
  for (const m of manifests) manifestMap.set(m.id, m);

  return sessions
    .filter((s) => s.manifest_id)
    .map((s) => {
      const m = manifestMap.get(s.manifest_id!);
      const expected = m?.total_expected ?? 0;
      const counted = s.total_counted;
      const variance = counted - expected;
      const variancePct = expected > 0 ? parseFloat(((variance / expected) * 100).toFixed(1)) : 0;
      return {
        id: s.id,
        batchCode: m?.manifest_code ?? s.id,
        product: m?.shipment_ref ?? m?.manifest_code ?? "—",
        expected,
        counted,
        variance,
        variancePct,
        status: s.reconciliation_status,
      };
    });
}

// Time-series computed client-side by aggregating all sessions by hour.
// Per-session time-series available at /sessions/{id}/timeseries endpoint.
function buildTimeSeries(sessions: CountSessionResponse[]): TimeSeriesPoint[] {
  // Group sessions by hour of created_at
  const hourMap = new Map<number, { bags: number; boxes: number }>();
  for (const s of sessions) {
    const h = new Date(s.created_at).getHours();
    const cur = hourMap.get(h) ?? { bags: 0, boxes: 0 };
    cur.bags += s.counted_bags;
    cur.boxes += s.counted_boxes;
    hourMap.set(h, cur);
  }

  // Build sorted array from earliest to latest hour present
  const hours = Array.from(hourMap.keys()).sort((a, b) => a - b);
  if (hours.length === 0) return [];

  const points: TimeSeriesPoint[] = [];
  let cumulative = 0;
  for (const h of hours) {
    const d = hourMap.get(h)!;
    cumulative += d.bags + d.boxes;
    points.push({
      time: `${h.toString().padStart(2, "0")}:00`,
      bags: d.bags,
      boxes: d.boxes,
      cumulative,
    });
  }
  return points;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CountingSummaryPage() {
  const [selectedSession] = useState<SessionRow | null>(null);
  const [countingFeedUrl, setCountingFeedUrl] = useState("");

  // API data
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [realtime, setRealtime] = useState<RealtimeCountsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [sessionsResult, manifestsResult, reportResult, realtimeResult] = await Promise.allSettled([
      getCountSessions(),
      getManifests(),
      getReconciliationReport(),
      getRealtimeCounts(),
    ]);

    const sessionsRaw = sessionsResult.status === "fulfilled" ? sessionsResult.value : [];
    const manifests = manifestsResult.status === "fulfilled" ? manifestsResult.value : [];
    const reportData = reportResult.status === "fulfilled" ? reportResult.value : null;
    const realtimeData = realtimeResult.status === "fulfilled" ? realtimeResult.value : null;

    if (sessionsResult.status === "rejected") console.error("CountingSummaryPage: sessions fetch failed", sessionsResult.reason);
    if (manifestsResult.status === "rejected") console.error("CountingSummaryPage: manifests fetch failed", manifestsResult.reason);
    if (reportResult.status === "rejected") console.error("CountingSummaryPage: report fetch failed", reportResult.reason);
    if (realtimeResult.status === "rejected") console.error("CountingSummaryPage: realtime fetch failed", realtimeResult.reason);

    setRealtime(realtimeData);
    setReport(reportData);

    const sessionRows = buildSessionRows(sessionsRaw, manifests);
    const liveCameras = realtimeData ? Object.values(realtimeData.cameras) : [];
    const liveTimestamp = realtimeData?.timestamp ?? new Date().toISOString();
    const liveRows: SessionRow[] = liveCameras.map((camera, index) => {
      const detections = camera.detections ?? [];
      const avgConfidence = detections.length > 0
        ? detections.reduce((sum, det) => sum + det.confidence, 0) / detections.length * 100
        : 0;
      const counted = typeof camera.total === "number"
        ? camera.total
        : detections.filter((det) => det.class.toLowerCase() === "bag").length;
      return {
        id: camera.camera_id,
        manifestCode: "LIVE",
        vehicleNumber: detections.length > 0 ? `${detections.length} active detection${detections.length === 1 ? "" : "s"}` : "No active detections",
        expectedBags: 0,
        expectedBoxes: 0,
        countedBags: classCount(camera, "bag"),
        countedBoxes: classCount(camera, "box"),
        totalExpected: 0,
        totalCounted: counted,
        discrepancy: counted,
        confidenceAvg: Number(avgConfidence.toFixed(1)),
        status: "pending",
        zone: camera.zone ?? `Camera ${index + 1}`,
        camera: camera.camera_id.slice(0, 8),
        timestamp: camera.last_update
          ? new Date(camera.last_update).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase()
          : new Date(liveTimestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase(),
      };
    });
    const rows = liveRows.length > 0 ? [...liveRows, ...sessionRows] : sessionRows;

    setSessions(rows);
    void buildBatchTallies(sessionsRaw, manifests);
    void buildTimeSeries(sessionsRaw);
    setLoading(false);
  }, []);

  useEffect(() => {
    setCountingFeedUrl(getCountingFeedUrl());
  }, []);

  useEffect(() => {
    let cancelled = false;
    
    const fetchDataSafe = async () => {
      if (cancelled) return;
      await fetchData();
    };
    
    fetchDataSafe();
    // Increased polling frequency from 5s to 10s for better performance
    const interval = setInterval(fetchDataSafe, 10_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [fetchData]);

  // Derived KPI values (from report when available, fallback to local) - Memoized for performance
  const derivedValues = useMemo(() => {
    const hasReportSessions = Boolean(report && report.total_sessions > 0);
    const liveCameras = realtime ? Object.values(realtime.cameras) : [];
    const primaryLiveCamera = liveCameras.find((camera) => camera.camera_id === "jsw-counting-line") ?? liveCameras[0];
    
    return {
      hasReportSessions,
      liveCameras,
      primaryLiveCamera,
      countLineTop: `${((realtime?.counting_line_y ?? 0.68) * 100).toFixed(2)}%`,
    };
  }, [report, realtime]);

  // Loading state
  if (loading) {
    return (
      <div className="p-5 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#E5521A] border-t-transparent rounded-full animate-spin" />
          <span className="text-[12px] text-[#8A9BBF] font-bold tracking-wide">Loading counting data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-[11px] text-[#E5521A] font-bold tracking-[0.1em] uppercase mb-1">
            Automated Counting
          </div>
          <h2 className="text-xl font-extrabold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
            Counting Summary
          </h2>
        </div>
      </div>

      {/* Live Counting Feed */}
      <div className="mb-5">
        <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] overflow-hidden">
          <div className="flex items-center justify-between px-[18px] py-3 border-b border-[#1E2F50]">
            <div className="flex items-center gap-2">
              <ScanLine className="w-4 h-4 text-[#E5521A]" />
              <span className="text-[13px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
                Live Counting Feed
              </span>
            </div>
            <span className="flex items-center gap-1.5 rounded-full border border-[#22D3A1]/30 bg-[#22D3A1]/10 px-2 py-0.5 text-[9px] font-bold text-[#22D3A1]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#22D3A1] animate-pulse" />
              {realtime?.running ? "COUNTER RUNNING" : "COUNTER SYNCING"}
            </span>
          </div>
          <div className="relative aspect-video bg-black">
            <LazyVideoFeed
              src={countingFeedUrl}
              alt="Product counting demonstration"
              className="h-full w-full"
            />
          </div>
        </div>
      </div>


        {/* Expanded detail */}
        {selectedSession && (
          <div className="mt-4 p-4 bg-[#0F1A30] rounded-xl border border-[#1E2F50]">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="text-[13px] font-bold text-[#E8EDF8]">{selectedSession.manifestCode} — Detail</div>
                <div className="text-[10px] text-[#8A9BBF] mt-0.5">Camera: {selectedSession.camera} · {selectedSession.zone}</div>
              </div>
              <span
                className="text-[10px] font-bold px-2 py-1 rounded-full border"
                style={{
                  background: `${reconciliationColor(selectedSession.status)}15`,
                  color: reconciliationColor(selectedSession.status),
                  borderColor: `${reconciliationColor(selectedSession.status)}30`,
                }}
              >
                {STATUS_LABEL[selectedSession.status]}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { l: "Bags", exp: selectedSession.expectedBags, cnt: selectedSession.countedBags },
                { l: "Boxes", exp: selectedSession.expectedBoxes, cnt: selectedSession.countedBoxes },
                { l: "Total", exp: selectedSession.totalExpected, cnt: selectedSession.totalCounted },
                { l: "Discrepancy", exp: null, cnt: null, val: selectedSession.discrepancy },
              ].map((d) => (
                <div key={d.l} className="bg-[#14203A] rounded-lg p-3 border border-[#1E2F50]">
                  <div className="text-[9px] text-[#4E6090] font-bold uppercase tracking-wide mb-1">{d.l}</div>
                  {d.exp !== null ? (
                    <div className="flex items-end gap-1">
                      <span className="text-[18px] font-extrabold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>{d.cnt}</span>
                      <span className="text-[10px] text-[#4E6090] mb-0.5">/ {d.exp}</span>
                    </div>
                  ) : (
                    <span
                      className="text-[18px] font-extrabold"
                      style={{ color: reconciliationColor(selectedSession.status), fontFamily: "'Syne', sans-serif" }}
                    >
                      {d.val! >= 0 ? "+" : ""}{d.val}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
  );
}
